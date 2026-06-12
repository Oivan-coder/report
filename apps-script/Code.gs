const API_VERSION = 'atlas-finance-v3';

const SHEETS = {
  settings: 'Settings',
  accounts: 'Accounts',
  incomeSchedule: 'IncomeSchedule',
  budgetGroups: 'BudgetGroups',
  categories: 'Categories',
  obligations: 'Obligations',
  goals: 'Goals',
  transactions: 'Transactions',
  monthlyReview: 'MonthlyReview',
  normalizationRules: 'NormalizationRules'
};

const HEADERS = {
  Settings: ['key', 'value', 'type', 'notes'],
  Accounts: ['account_id', 'name', 'account_type', 'current_balance', 'include_in_cashflow', 'include_in_net_worth', 'currency', 'as_of_date', 'notes'],
  IncomeSchedule: ['income_id', 'name', 'day_of_month', 'amount', 'move_rule', 'default_account_id', 'active', 'notes'],
  BudgetGroups: ['budget_group_id', 'name', 'group_type', 'monthly_limit', 'include_in_daily_limit', 'notes'],
  Categories: ['category_id', 'name', 'budget_group_id', 'record_type', 'purpose', 'active', 'notes'],
  Obligations: ['obligation_id', 'name', 'category_id', 'baseline_amount', 'due_day', 'ask_monthly', 'active', 'notes'],
  Goals: ['goal_id', 'name', 'category_id', 'target_amount', 'current_amount', 'monthly_plan', 'priority', 'active', 'flexible_target', 'notes'],
  Transactions: ['transaction_id', 'date', 'type', 'account_id', 'category_id', 'budget_group_id', 'original_category', 'description', 'amount', 'currency', 'review_needed', 'source', 'source_row', 'created_at', 'updated_at', 'notes'],
  MonthlyReview: ['period', 'item_id', 'prompt', 'item_type', 'target_id', 'expected_amount', 'actual_amount', 'status', 'notes'],
  NormalizationRules: ['original_category', 'description_regex', 'category_id', 'confidence', 'notes']
};

function doGet(e) {
  return handle_(function () {
    ensureSchema_();
    const action = (e && e.parameter && e.parameter.action) || 'health';
    if (action === 'health') return { ok: true, service: 'Atlas Finance API', version: API_VERSION };
    if (action === 'bootstrap') return buildBootstrap_();
    if (action === 'transactions') return readTransactionsForApp_();
    if (action === 'schema') return { ok: true, version: API_VERSION, sheets: SHEETS, headers: HEADERS };
    return { ok: false, error: 'Unknown action: ' + action };
  });
}

function doPost(e) {
  return handle_(function () {
    ensureSchema_();
    const body = parseBody_(e);
    const action = body.action || '';
    if (action === 'appendTransaction') return appendTransaction_(body.payload || {});
    if (action === 'updateTransaction') return updateTransaction_(body.payload || {});
    if (action === 'updateAccount') return updateAccount_(body.payload || {});
    if (action === 'answerMonthlyReview') return answerMonthlyReview_(body.payload || {});
    if (action === 'syncBatch') return syncBatch_(body.payload || {});
    return { ok: false, error: 'Unknown action: ' + action };
  });
}

function buildBootstrap_() {
  const tables = readAllTables_();
  return {
    ok: true,
    version: API_VERSION,
    serverTime: new Date().toISOString(),
    settings: buildAppSettings_(tables),
    transactions: readTransactionsForApp_(tables),
    tables: tables
  };
}

function buildAppSettings_(tables) {
  const settingsRows = tables.settings;
  const incomeRows = tables.incomeSchedule.filter(function (row) { return toBool_(row.active, true); });
  const salary = findBy_(incomeRows, 'income_id', 'salary');
  const advance = findBy_(incomeRows, 'income_id', 'advance');
  const monthlyReview = tables.monthlyReview;

  const budgetGroups = tables.budgetGroups
    .filter(function (group) {
      const type = String(group.group_type || '');
      return toBool_(group.include_in_daily_limit, true) && ['variable', 'transport', 'fixed', 'reserve', 'other'].indexOf(type) !== -1;
    })
    .map(function (group) {
      const defaultCategory = tables.categories.find(function (category) {
        return category.budget_group_id === group.budget_group_id && toBool_(category.active, true);
      });
      return {
        id: group.budget_group_id,
        name: group.name,
        group: group.group_type,
        monthlyLimit: toNumber_(group.monthly_limit),
        defaultCategoryId: defaultCategory ? defaultCategory.category_id : group.budget_group_id
      };
    });

  const accounts = tables.accounts.map(function (account) {
    return {
      id: account.account_id,
      name: account.name,
      type: account.account_type,
      balance: toNumber_(account.current_balance),
      includeInCashflow: toBool_(account.include_in_cashflow, true),
      includeInNetWorth: toBool_(account.include_in_net_worth, true)
    };
  });

  const obligations = tables.obligations.map(function (obligation) {
    const actual = reviewActual_(monthlyReview, obligation.obligation_id);
    return {
      id: obligation.obligation_id,
      name: obligation.name,
      amount: actual === null ? 0 : actual,
      baselineAmount: toNumber_(obligation.baseline_amount),
      dueDay: toNullableNumber_(obligation.due_day),
      active: actual !== null,
      askMonthly: toBool_(obligation.ask_monthly, true)
    };
  });

  const goals = tables.goals.map(function (goal) {
    const actual = reviewActual_(monthlyReview, goal.goal_id);
    return {
      id: goal.goal_id,
      name: goal.name,
      target: toNullableNumber_(goal.target_amount),
      current: toNumber_(goal.current_amount),
      monthlyPlan: actual === null ? 0 : actual,
      baselineMonthlyPlan: toNumber_(goal.monthly_plan),
      priority: toNumber_(goal.priority),
      flexibleTarget: toBool_(goal.flexible_target, false)
    };
  });

  return {
    currency: '₽',
    accountBalanceMode: 'current',
    salaryDay: toNumber_(salary && salary.day_of_month) || toNumber_(settingValue_(settingsRows, 'salary_day')) || 15,
    advanceDay: toNumber_(advance && advance.day_of_month) || toNumber_(settingValue_(settingsRows, 'advance_day')) || 30,
    paydayMoveRule: (salary && salary.move_rule) || settingValue_(settingsRows, 'payday_move_rule') || 'previous-business-day',
    accounts: accounts,
    categories: budgetGroups,
    obligations: obligations,
    goals: goals
  };
}

function readTransactionsForApp_(tables) {
  const source = tables || readAllTables_();
  const categoriesById = indexBy_(source.categories, 'category_id');
  const budgetGroupsById = indexBy_(source.budgetGroups, 'budget_group_id');
  const accountsById = indexBy_(source.accounts, 'account_id');

  return source.transactions
    .filter(function (row) { return row.transaction_id || row.date || row.amount; })
    .map(function (row) {
      const category = categoriesById[row.category_id] || {};
      const budgetGroup = budgetGroupsById[row.budget_group_id] || {};
      const account = accountsById[row.account_id] || {};
      return {
        id: row.transaction_id,
        date: normalizeValue_(row.date),
        type: row.type || 'expense',
        account: account.name || row.account_id || '',
        accountId: row.account_id || '',
        category: budgetGroup.name || category.name || row.category_id || 'Прочее',
        categoryId: row.category_id || '',
        categoryDetail: category.name || '',
        budgetGroupId: row.budget_group_id || '',
        originalCategory: row.original_category || '',
        description: row.description || '',
        amount: toNumber_(row.amount),
        currency: row.currency || 'RUB',
        reviewNeeded: toBool_(row.review_needed, false),
        comment: row.notes || ''
      };
    })
    .sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
}

function appendTransaction_(payload) {
  const tx = normalizeIncomingTransaction_(payload);
  const sheet = getSheet_(SHEETS.transactions);
  const headers = getHeaders_(sheet);
  const row = headers.map(function (header) { return tx[header] === undefined ? '' : tx[header]; });
  sheet.appendRow(row);
  return { ok: true, transaction: readTransactionRowForApp_(tx) };
}

function updateTransaction_(payload) {
  const id = payload.transaction_id || payload.id;
  if (!id) throw new Error('transaction_id is required');
  const patch = normalizeIncomingTransaction_(payload, true);
  patch.transaction_id = id;
  const updated = updateRowById_(SHEETS.transactions, 'transaction_id', id, patch);
  return { ok: true, transaction: readTransactionRowForApp_(updated) };
}

function updateAccount_(payload) {
  const id = payload.account_id || payload.id;
  if (!id) throw new Error('account_id is required');
  const patch = {
    account_id: id,
    current_balance: toNumber_(payload.current_balance !== undefined ? payload.current_balance : payload.balance),
    as_of_date: parseDate_(payload.as_of_date || payload.date || new Date()),
    notes: payload.notes || payload.comment || ''
  };
  const updated = updateRowById_(SHEETS.accounts, 'account_id', id, patch);
  return { ok: true, account: updated };
}

function answerMonthlyReview_(payload) {
  const period = payload.period || currentPeriod_();
  const itemId = payload.item_id || payload.id;
  if (!itemId) throw new Error('item_id is required');

  const patch = {
    period: period,
    item_id: itemId,
    actual_amount: toNumber_(payload.actual_amount !== undefined ? payload.actual_amount : payload.amount),
    status: payload.status || 'done',
    notes: payload.notes || ''
  };

  const updated = updateMonthlyReviewRow_(period, itemId, patch);
  return { ok: true, review: updated };
}

function syncBatch_(payload) {
  const transactions = payload.transactions || [];
  const results = transactions.map(function (tx) { return appendTransaction_(tx).transaction; });
  return { ok: true, count: results.length, transactions: results };
}

function normalizeIncomingTransaction_(payload, partial) {
  const resolved = resolveCategory_(payload);
  const now = new Date();
  const id = payload.transaction_id || payload.id || Utilities.getUuid();
  const row = {
    transaction_id: id,
    date: parseDate_(payload.date || now),
    type: payload.type || 'expense',
    account_id: payload.account_id || payload.accountId || resolveAccountId_(payload.account),
    category_id: resolved.categoryId,
    budget_group_id: resolved.budgetGroupId,
    original_category: payload.original_category || payload.originalCategory || payload.category || '',
    description: payload.description || '',
    amount: toNumber_(payload.amount),
    currency: payload.currency || 'RUB',
    review_needed: toBool_(payload.review_needed || payload.reviewNeeded, false),
    source: payload.source || 'web-app',
    source_row: payload.source_row || '',
    created_at: parseDate_(payload.created_at || payload.createdAt || now),
    updated_at: now,
    notes: payload.notes || payload.comment || ''
  };

  if (!partial) return row;
  Object.keys(row).forEach(function (key) {
    if (row[key] === '' || row[key] === null || row[key] === undefined) delete row[key];
  });
  return row;
}

function resolveCategory_(payload) {
  const tables = readAllTables_();
  const categories = tables.categories;
  const groups = tables.budgetGroups;
  const categoryId = payload.category_id || payload.categoryId;
  const budgetGroupId = payload.budget_group_id || payload.budgetGroupId;
  const categoryName = payload.category || payload.categoryName || '';

  if (categoryId && findBy_(categories, 'category_id', categoryId)) {
    const category = findBy_(categories, 'category_id', categoryId);
    return { categoryId: category.category_id, budgetGroupId: category.budget_group_id };
  }

  if (budgetGroupId && findBy_(groups, 'budget_group_id', budgetGroupId)) {
    return { categoryId: defaultCategoryForGroup_(categories, budgetGroupId), budgetGroupId: budgetGroupId };
  }

  const categoryByName = categories.find(function (category) { return category.name === categoryName; });
  if (categoryByName) return { categoryId: categoryByName.category_id, budgetGroupId: categoryByName.budget_group_id };

  const groupByName = groups.find(function (group) { return group.name === categoryName; });
  if (groupByName) {
    return { categoryId: defaultCategoryForGroup_(categories, groupByName.budget_group_id), budgetGroupId: groupByName.budget_group_id };
  }

  return { categoryId: 'other', budgetGroupId: 'other' };
}

function defaultCategoryForGroup_(categories, groupId) {
  const category = categories.find(function (row) {
    return row.budget_group_id === groupId && toBool_(row.active, true);
  });
  return category ? category.category_id : groupId;
}

function readTransactionRowForApp_(row) {
  return readTransactionsForApp_({
    transactions: [row],
    categories: readTable_(SHEETS.categories),
    budgetGroups: readTable_(SHEETS.budgetGroups),
    accounts: readTable_(SHEETS.accounts)
  })[0];
}

function readAllTables_() {
  return {
    settings: readTable_(SHEETS.settings),
    accounts: readTable_(SHEETS.accounts),
    incomeSchedule: readTable_(SHEETS.incomeSchedule),
    budgetGroups: readTable_(SHEETS.budgetGroups),
    categories: readTable_(SHEETS.categories),
    obligations: readTable_(SHEETS.obligations),
    goals: readTable_(SHEETS.goals),
    transactions: readTable_(SHEETS.transactions),
    monthlyReview: readTable_(SHEETS.monthlyReview),
    normalizationRules: readTable_(SHEETS.normalizationRules)
  };
}

function readTable_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (header) { return String(header || '').trim(); });
  return values.slice(1)
    .filter(function (row) { return row.some(function (value) { return value !== '' && value !== null; }); })
    .map(function (row) {
      const record = {};
      headers.forEach(function (header, index) { record[header] = normalizeValue_(row[index]); });
      return record;
    });
}

function updateRowById_(sheetName, idColumn, id, patch) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return String(header || '').trim(); });
  const idIndex = headers.indexOf(idColumn);
  if (idIndex === -1) throw new Error('Missing id column: ' + idColumn);

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][idIndex]) === String(id)) {
      const existing = {};
      headers.forEach(function (header, index) { existing[header] = values[i][index]; });
      const merged = Object.assign({}, existing, patch);
      const row = headers.map(function (header) { return merged[header] === undefined ? '' : merged[header]; });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return objectFromRow_(headers, row);
    }
  }
  throw new Error('Row not found: ' + id);
}

function updateMonthlyReviewRow_(period, itemId, patch) {
  const sheet = getSheet_(SHEETS.monthlyReview);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) { return String(header || '').trim(); });
  const periodIndex = headers.indexOf('period');
  const itemIndex = headers.indexOf('item_id');

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][periodIndex]) === String(period) && String(values[i][itemIndex]) === String(itemId)) {
      const existing = objectFromRow_(headers, values[i]);
      const merged = Object.assign({}, existing, patch);
      const row = headers.map(function (header) { return merged[header] === undefined ? '' : merged[header]; });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([row]);
      return objectFromRow_(headers, row);
    }
  }

  const row = headers.map(function (header) { return patch[header] === undefined ? '' : patch[header]; });
  sheet.appendRow(row);
  return objectFromRow_(headers, row);
}

function ensureSchema_() {
  Object.keys(SHEETS).forEach(function (key) {
    const sheetName = SHEETS[key];
    const expected = HEADERS[sheetName];
    const sheet = ensureSheet_(sheetName);
    const values = sheet.getDataRange().getValues();
    if (!values.length || values[0].every(function (cell) { return cell === ''; })) {
      sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
      return;
    }
    const actual = values[0].slice(0, expected.length).map(function (header) { return String(header || '').trim(); });
    const mismatch = expected.some(function (header, index) { return actual[index] !== header; });
    if (mismatch) throw new Error('Header mismatch on sheet ' + sheetName + '. Expected: ' + expected.join(', '));
  });
}

function ensureSheet_(sheetName) {
  const ss = spreadsheet_();
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function getSheet_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (header) { return String(header || '').trim(); });
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet. Set Script Property SPREADSHEET_ID.');
  return ss;
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function parseDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  if (value === '') return null;
  return value;
}

function toBool_(value, fallback) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return fallback === undefined ? false : fallback;
  const text = String(value).toLowerCase();
  return text === 'true' || text === 'yes' || text === '1' || text === 'да';
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function toNullableNumber_(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function settingValue_(rows, key) {
  const row = findBy_(rows, 'key', key);
  return row ? row.value : null;
}

function reviewActual_(rows, targetId) {
  const row = rows.find(function (item) {
    return item.target_id === targetId && item.actual_amount !== null && item.actual_amount !== '';
  });
  return row ? toNumber_(row.actual_amount) : null;
}

function resolveAccountId_(name) {
  if (!name) return 'vtb_main';
  const accounts = readTable_(SHEETS.accounts);
  const match = accounts.find(function (account) { return account.name === name || account.account_id === name; });
  return match ? match.account_id : 'vtb_main';
}

function currentPeriod_() {
  const now = new Date();
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM');
}

function findBy_(rows, key, value) {
  return rows.find(function (row) { return String(row[key]) === String(value); });
}

function indexBy_(rows, key) {
  return rows.reduce(function (acc, row) {
    acc[row[key]] = row;
    return acc;
  }, {});
}

function objectFromRow_(headers, row) {
  const record = {};
  headers.forEach(function (header, index) { record[header] = normalizeValue_(row[index]); });
  return record;
}

function handle_(callback) {
  try {
    return json_(callback());
  } catch (error) {
    return json_({ ok: false, error: error.message, stack: error.stack });
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
