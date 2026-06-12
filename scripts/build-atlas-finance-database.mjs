import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const SOURCE_JSON = 'outputs/atlas_finance_v3_database/source_transactions.json';
const OUTPUT_XLSX = 'outputs/atlas_finance_v3_database/Atlas_Finance_v3_database.xlsx';

const input = JSON.parse(await fs.readFile(SOURCE_JSON, 'utf8'));
const now = excelDate(2026, 6, 12);
const currentCycleStart = excelDate(2026, 5, 29);
const currentCycleEnd = excelDate(2026, 6, 15);

const categories = [
  ['food_groceries', 'Еда дома', 'food_home', 'expense', 'Продукты для дома', true, 'Супермаркеты, продукты домой'],
  ['food_workday', 'Еда вне дома: завтрак/обед', 'food_out', 'expense', 'Питание в течение дня', true, 'Мак, обед, кофейня, ВкусВилл на работе'],
  ['leisure_bar', 'Досуг: бар/кафе/друзья', 'food_out', 'expense', 'Социальный досуг', true, 'Бар, алкоголь, посиделки с друзьями'],
  ['transport_fuel', 'Бензин', 'transport_fuel_tolls', 'expense', 'Топливо', true, 'АЗС и заправки'],
  ['transport_tolls', 'Платные дороги', 'transport_fuel_tolls', 'expense', 'Платные дороги', true, 'Платка, транспондер, дороги'],
  ['transport_car_service', 'Авто: обслуживание и услуги', 'car_service', 'expense', 'Текущие авторасходы', true, 'Госуслуги, сервис, мойка, мелкий ремонт'],
  ['communications', 'Связь и подписки', 'communications', 'expense', 'Связь/сервисы', true, 'Телефон, цифровой контент, подписки'],
  ['parking_home', 'Домашняя парковка', 'housing', 'expense', 'Дом/парковка', true, 'Парковочное место дома, если оплачивается отдельно'],
  ['shopping_hobby', 'Одежда/техника/хобби', 'shopping_hobby', 'expense', 'Покупки не первой необходимости', true, 'Одежда, техника, хобби, услуги'],
  ['gifts_social', 'Подарки и сборы', 'shopping_hobby', 'expense', 'Социальные расходы', true, 'ДР, сборы на работе, подарки'],
  ['people_transfers', 'Переводы людям', 'people_transfers', 'expense', 'Переводы', true, 'Разовые переводы людям'],
  ['health', 'Здоровье', 'health', 'expense', 'Медицина', true, 'Стоматолог, врачи, лекарства'],
  ['cat', 'Кошка', 'cat', 'expense', 'Питомец', true, 'Корм, наполнитель, ветеринарка'],
  ['family_support', 'Родителям', 'family_support', 'obligation', 'Гибкое обязательство', false, 'Сумму лучше подтверждать каждый месяц'],
  ['housing', 'ЖКХ/дом', 'housing', 'obligation', 'Гибкое обязательство', false, 'ЖКХ, дом, иногда парковочное место'],
  ['investments', 'Акции/облигации', 'investments', 'investment', 'Инвестиции', false, 'Пополнения брокерского счета не считать расходом на жизнь'],
  ['goal_watches', 'Цель: часы', 'goals', 'saving_goal', 'Накопление', false, 'Цель 30 000 ₽, комфортный план 10 000 ₽/мес'],
  ['goal_car_bodywork', 'Цель: арки + бампер', 'goals', 'saving_goal', 'Накопление', false, 'Цель 120 000 ₽'],
  ['goal_nz', 'НЗ', 'goals', 'saving_goal', 'Накопление', false, 'Короткий неприкасаемый запас'],
  ['goal_emergency_fund', 'Подушка безопасности', 'goals', 'saving_goal', 'Накопление', false, 'Большая подушка 1 000 000 ₽'],
  ['goal_vacation', 'Отпуск', 'goals', 'saving_goal', 'Гибкое накопление', false, 'Без жесткого лимита пока отпуск не запланирован'],
  ['month_reserve', 'Резерв месяца', 'month_reserve', 'reserve', 'Резерв', true, 'Непредвиденные траты месяца'],
  ['other', 'Прочее', 'other', 'expense', 'Прочее', true, 'Временная категория для операций без классификации'],
];

const budgetGroups = [
  ['food_home', 'Еда дома', 'variable', 25000, true, 'из текущего Ref'],
  ['food_out', 'Еда вне дома и досуг', 'variable', 10000, true, 'разделено на рабочую еду и бар/досуг'],
  ['transport_fuel_tolls', 'Бензин и платные дороги', 'transport', 20000, true, 'из текущего Ref'],
  ['car_service', 'Текущие расходы авто', 'variable', 10000, true, 'добавлено из текущей фактической структуры'],
  ['communications', 'Связь/подписки', 'fixed', 10000, true, 'из текущего Ref'],
  ['shopping_hobby', 'Одежда/техника/хобби/подарки', 'variable', 10000, true, 'из текущего Ref'],
  ['people_transfers', 'Переводы людям', 'variable', 5000, true, 'стартовый лимит из текущего приложения'],
  ['health', 'Здоровье', 'variable', 20000, true, 'из текущего Ref'],
  ['cat', 'Кошка', 'variable', 5000, true, 'из текущего Ref'],
  ['family_support', 'Родителям', 'obligation', 30000, false, 'baseline, каждый месяц подтверждать руками'],
  ['housing', 'ЖКХ/дом/парковка', 'obligation', 10000, false, 'baseline, каждый месяц подтверждать руками'],
  ['goals', 'Накопления', 'saving', 40000, false, 'НЗ, часы, машина, подушка, отпуск'],
  ['investments', 'Инвестиции', 'investment', 0, false, 'без жесткого лимита, не учитывать в свободных деньгах'],
  ['month_reserve', 'Резерв месяца', 'reserve', 10000, true, 'из текущего Ref'],
  ['other', 'Прочее', 'other', 0, true, 'только для временной классификации'],
];

const accounts = [
  ['vtb_main', 'ВТБ', 'checking', 1580, true, true, 'RUB', now, 'Фактический остаток до 15-го числа'],
  ['brokerage', 'Фонд в акциях/облигациях', 'investment', 153000, false, true, 'RUB', now, 'Не учитывать в дневном лимите, но держать для net worth'],
  ['cash', 'Наличные', 'cash', 0, true, true, 'RUB', now, 'Запасная строка'],
];

const incomeSchedule = [
  ['salary', 'Зарплата', 15, 185000, 'previous-business-day', 'vtb_main', true, 'Основная зарплата'],
  ['advance', 'Аванс', 30, 15000, 'previous-business-day', 'vtb_main', true, 'Аванс'],
];

const obligations = [
  ['parents', 'Родителям', 'family_support', 30000, null, true, true, 'Сумма плавает: приложение должно спрашивать каждый месяц'],
  ['housing', 'ЖКХ/дом/парковка', 'housing', 10000, null, true, true, 'ЖКХ плюс парковочное место, если попадает в месяц'],
];

const goals = [
  ['watches', 'Часы', 'goal_watches', 30000, 0, 10000, 1, true, false, 'План уменьшен до 10 000 ₽/мес'],
  ['car_bodywork', 'Арки + бампер', 'goal_car_bodywork', 120000, 0, 15000, 2, true, false, 'Реальная цель'],
  ['nz', 'НЗ', 'goal_nz', 100000, 0, 10000, 3, true, false, 'Короткий неприкасаемый запас'],
  ['emergency_fund', 'Подушка безопасности', 'goal_emergency_fund', 1000000, 0, 10000, 4, true, false, 'Большая подушка'],
  ['vacation', 'Отпуск', 'goal_vacation', null, 0, 0, 5, true, true, 'Без жесткого лимита, можно откладывать когда удобно'],
  ['investments', 'Акции/облигации', 'investments', null, 153000, 0, 6, true, true, 'Учитывать как актив, не как расход на жизнь'],
];

const monthlyReview = [
  ['2026-06', 'reconcile_vtb', 'Сколько денег сейчас на ВТБ?', 'account', 'vtb_main', 1580, 1580, 'done', 'После сверки обновить Accounts.current_balance'],
  ['2026-06', 'parents_paid', 'Сколько в этом месяце скинули родителям?', 'obligation', 'parents', 30000, null, 'open', 'Если сумма отличается от 30 000, вводить фактическую'],
  ['2026-06', 'housing_paid', 'Сколько ушло на ЖКХ/дом/парковку?', 'obligation', 'housing', 10000, null, 'open', 'Можно включать парковочное место дома'],
  ['2026-06', 'invested', 'Сколько положили в акции/облигации?', 'investment', 'investments', 0, null, 'open', 'Пополнение брокерского счета, не обычный расход'],
  ['2026-06', 'watches_saved', 'Сколько отложили на часы?', 'goal', 'watches', 10000, null, 'open', 'Мягкий план 10 000 ₽'],
  ['2026-06', 'car_bodywork_saved', 'Сколько отложили на арки + бампер?', 'goal', 'car_bodywork', 15000, null, 'open', 'Цель 120 000 ₽'],
  ['2026-06', 'nz_saved', 'Сколько отложили в НЗ?', 'goal', 'nz', 10000, null, 'open', 'Короткий запас'],
  ['2026-06', 'vacation_saved', 'Было ли что-то отложено на отпуск?', 'goal', 'vacation', 0, null, 'optional', 'Без жесткого лимита'],
];

const normalizationRules = [
  ['Кафе/бар/доставка', 'мак|обед|завтрак|вкус вилл|кофепорт|вв обед', 'food_workday', 0.9, 'Рабочая еда/быстрый прием пищи'],
  ['Кафе/бар/доставка', 'алкоголь|посидел|бар', 'leisure_bar', 0.95, 'Досуг и бар'],
  ['Кафе/бар/доставка', '', 'food_workday', 0.5, 'Нужна ручная проверка, если нет описания'],
  ['Бензин', 'платк', 'transport_tolls', 0.95, 'Платные дороги отдельно от бензина'],
  ['Бензин', '', 'transport_fuel', 0.85, 'По умолчанию бензин'],
  ['Текущие расходы авто', 'азс', 'transport_fuel', 0.95, 'АЗС распознать как бензин'],
  ['Текущие расходы авто', '', 'transport_car_service', 0.8, 'Автоуслуги и госуслуги'],
  ['Еда дома', '', 'food_groceries', 0.95, 'Продукты домой'],
  ['Связь/подписки/парковка', '', 'communications', 0.85, 'Связь/подписки пока вместе'],
  ['Одежда/техника/хобби', 'др|подар', 'gifts_social', 0.9, 'Подарки/сборы отделить от покупок'],
  ['Одежда/техника/хобби', '', 'shopping_hobby', 0.85, 'Покупки и хобби'],
  ['Переводы людям', '', 'people_transfers', 0.9, 'Переводы людям'],
];

function normalizeTransaction(tx, index) {
  const original = String(tx.original_category || '').toLowerCase();
  const description = String(tx.description || '').toLowerCase();
  let categoryId = 'other';
  let reviewNeeded = false;
  let note = '';

  if (original.includes('еда дома')) categoryId = 'food_groceries';
  else if (original.includes('бензин')) {
    categoryId = description.includes('платк') ? 'transport_tolls' : 'transport_fuel';
  } else if (original.includes('текущие расходы авто')) {
    categoryId = description.includes('азс') ? 'transport_fuel' : 'transport_car_service';
  } else if (original.includes('связь')) categoryId = 'communications';
  else if (original.includes('переводы')) categoryId = 'people_transfers';
  else if (original.includes('одежда')) categoryId = /др|подар/.test(description) ? 'gifts_social' : 'shopping_hobby';
  else if (original.includes('кафе')) {
    if (/алкоголь|посидел|бар/.test(description)) categoryId = 'leisure_bar';
    else if (/мак|обед|завтрак|вкус вилл|кофепорт|вв обед/.test(description)) categoryId = 'food_workday';
    else {
      categoryId = 'food_workday';
      reviewNeeded = true;
      note = 'Неоднозначная старая операция кафе: подтвердить еда это или досуг';
    }
  }

  const category = categories.find((row) => row[0] === categoryId);
  return [
    `tx-202606-${String(index + 1).padStart(4, '0')}`,
    parseDate(tx.date),
    'expense',
    'vtb_main',
    categoryId,
    category?.[2] || 'other',
    tx.original_category || '',
    tx.description || '',
    tx.amount,
    'RUB',
    reviewNeeded,
    'Atlas_Finance_v2_moneyflow.xlsx',
    tx.source_row,
    now,
    now,
    note || tx.comment || '',
  ];
}

function parseDate(value) {
  if (!value) return null;
  const [datePart, timePart = '00:00:00'] = String(value).split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  return excelDate(year, month, day, hour || 0, minute || 0, second || 0);
}

function excelDate(year, month, day, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

function colName(index) {
  let n = index;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

function writeTable(sheet, headers, rows, options = {}) {
  const lastCol = colName(headers.length);
  const lastRow = rows.length + 1;
  sheet.getRange(`A1:${lastCol}${lastRow}`).values = [headers, ...rows];
  const header = sheet.getRange(`A1:${lastCol}1`);
  header.format = {
    fill: '#111827',
    font: { color: '#FFFFFF', bold: true },
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    wrapText: true,
  };
  sheet.getRange(`A1:${lastCol}${lastRow}`).format = {
    borders: { preset: 'outside', style: 'thin', color: '#D1D5DB' },
    verticalAlignment: 'top',
    wrapText: true,
  };
  sheet.freezePanes.freezeRows(1);
  if (options.widths) {
    for (const [col, width] of Object.entries(options.widths)) {
      sheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
    }
  }
  if (options.currencyCols) {
    for (const col of options.currencyCols) sheet.getRange(`${col}2:${col}${lastRow}`).format.numberFormat = '#,##0 ₽;[Red]-#,##0 ₽;-';
  }
  if (options.dateCols) {
    for (const col of options.dateCols) sheet.getRange(`${col}2:${col}${lastRow}`).format.numberFormat = 'yyyy-mm-dd hh:mm';
  }
  if (options.integerCols) {
    for (const col of options.integerCols) sheet.getRange(`${col}2:${col}${lastRow}`).format.numberFormat = '#,##0';
  }
}

function addReadme(workbook) {
  const sheet = workbook.worksheets.add('README');
  sheet.getRange('A1:D1').merge();
  sheet.getRange('A1').values = [['Atlas Finance v3 database']];
  sheet.getRange('A1').format = { fill: '#111827', font: { color: '#FFFFFF', bold: true, size: 18 } };
  sheet.getRange('A3:D12').values = [
    ['Назначение', 'База для Google Sheets и будущего веб-приложения', '', ''],
    ['Главный источник фактов', 'Transactions', '', ''],
    ['Текущие операции сохранены', input.transactions.length, '', ''],
    ['Фактический остаток cashflow', '1 580 ₽ на ВТБ до 15-го', '', ''],
    ['Инвестиционный фонд', '153 000 ₽, не входит в дневной лимит', '', ''],
    ['Выплаты', 'зарплата 15-го 185 000 ₽, аванс 30-го 15 000 ₽', '', ''],
    ['UX-идея', 'MonthlyReview хранит вопросы месяца: родителям, ЖКХ, инвестиции, цели', '', ''],
    ['Импорт в Google Sheets', 'Загрузить этот xlsx как Google Sheets, потом подключить Apps Script API', '', ''],
    ['Правило', 'Не редактировать id вручную после подключения приложения', '', ''],
    ['Версия', 'v3 draft, 2026-06-12', '', ''],
  ];
  sheet.getRange('A3:A12').format = { font: { bold: true }, fill: '#E5E7EB' };
  sheet.getRange('A:D').format.columnWidthPx = 220;
}

const workbook = Workbook.create();
addReadme(workbook);

writeTable(
  workbook.worksheets.add('Settings'),
  ['key', 'value', 'type', 'notes'],
  [
    ['currency', 'RUB', 'string', 'Основная валюта'],
    ['as_of_date', now, 'date', 'Дата сборки базы'],
    ['salary_day', 15, 'number', 'День основной зарплаты'],
    ['advance_day', 30, 'number', 'День аванса'],
    ['salary_amount', 185000, 'money', 'Плановая зарплата'],
    ['advance_amount', 15000, 'money', 'Плановый аванс'],
    ['payday_move_rule', 'previous-business-day', 'string', 'Если выходной, перенос на предыдущий рабочий день'],
    ['current_cycle_start', currentCycleStart, 'date', 'Старт текущего цикла'],
    ['current_cycle_end', currentCycleEnd, 'date', 'Следующее поступление'],
    ['timezone', 'Europe/Moscow', 'string', 'Часовой пояс пользователя'],
  ],
  { widths: { A: 180, B: 220, C: 120, D: 420 } },
);
const settingsSheet = workbook.worksheets.getItem('Settings');
settingsSheet.getRange('B3').format.numberFormat = 'yyyy-mm-dd';
settingsSheet.getRange('B6:B7').format.numberFormat = '#,##0 ₽;[Red]-#,##0 ₽;-';
settingsSheet.getRange('B9:B10').format.numberFormat = 'yyyy-mm-dd';

writeTable(
  workbook.worksheets.add('Accounts'),
  ['account_id', 'name', 'account_type', 'current_balance', 'include_in_cashflow', 'include_in_net_worth', 'currency', 'as_of_date', 'notes'],
  accounts,
  { widths: { A: 150, B: 260, C: 130, D: 150, E: 150, F: 160, G: 90, H: 150, I: 420 }, currencyCols: ['D'], dateCols: ['H'] },
);

writeTable(
  workbook.worksheets.add('IncomeSchedule'),
  ['income_id', 'name', 'day_of_month', 'amount', 'move_rule', 'default_account_id', 'active', 'notes'],
  incomeSchedule,
  { widths: { A: 140, B: 160, C: 110, D: 140, E: 190, F: 150, G: 90, H: 360 }, currencyCols: ['D'], integerCols: ['C'] },
);

writeTable(
  workbook.worksheets.add('BudgetGroups'),
  ['budget_group_id', 'name', 'group_type', 'monthly_limit', 'include_in_daily_limit', 'notes'],
  budgetGroups,
  { widths: { A: 180, B: 280, C: 140, D: 150, E: 160, F: 420 }, currencyCols: ['D'] },
);

writeTable(
  workbook.worksheets.add('Categories'),
  ['category_id', 'name', 'budget_group_id', 'record_type', 'purpose', 'active', 'notes'],
  categories,
  { widths: { A: 190, B: 260, C: 180, D: 120, E: 210, F: 90, G: 420 } },
);

writeTable(
  workbook.worksheets.add('Obligations'),
  ['obligation_id', 'name', 'category_id', 'baseline_amount', 'due_day', 'ask_monthly', 'active', 'notes'],
  obligations,
  { widths: { A: 150, B: 230, C: 180, D: 150, E: 100, F: 120, G: 90, H: 460 }, currencyCols: ['D'], integerCols: ['E'] },
);

writeTable(
  workbook.worksheets.add('Goals'),
  ['goal_id', 'name', 'category_id', 'target_amount', 'current_amount', 'monthly_plan', 'priority', 'active', 'flexible_target', 'notes'],
  goals,
  { widths: { A: 160, B: 240, C: 190, D: 150, E: 150, F: 150, G: 90, H: 90, I: 130, J: 430 }, currencyCols: ['D', 'E', 'F'], integerCols: ['G'] },
);

const transactions = input.transactions.map(normalizeTransaction);
writeTable(
  workbook.worksheets.add('Transactions'),
  ['transaction_id', 'date', 'type', 'account_id', 'category_id', 'budget_group_id', 'original_category', 'description', 'amount', 'currency', 'review_needed', 'source', 'source_row', 'created_at', 'updated_at', 'notes'],
  transactions,
  { widths: { A: 170, B: 150, C: 90, D: 120, E: 180, F: 180, G: 220, H: 240, I: 130, J: 90, K: 120, L: 260, M: 90, N: 150, O: 150, P: 360 }, currencyCols: ['I'], dateCols: ['B', 'N', 'O'], integerCols: ['M'] },
);

writeTable(
  workbook.worksheets.add('MonthlyReview'),
  ['period', 'item_id', 'prompt', 'item_type', 'target_id', 'expected_amount', 'actual_amount', 'status', 'notes'],
  monthlyReview,
  { widths: { A: 100, B: 170, C: 380, D: 120, E: 160, F: 150, G: 150, H: 100, I: 420 }, currencyCols: ['F', 'G'] },
);

writeTable(
  workbook.worksheets.add('NormalizationRules'),
  ['original_category', 'description_regex', 'category_id', 'confidence', 'notes'],
  normalizationRules,
  { widths: { A: 220, B: 280, C: 190, D: 100, E: 420 } },
);

const dashboard = workbook.worksheets.add('Dashboard');
dashboard.getRange('A1:D1').merge();
dashboard.getRange('A1').values = [['Atlas Finance — контрольные показатели базы']];
dashboard.getRange('A1').format = { fill: '#111827', font: { color: '#FFFFFF', bold: true, size: 16 } };
dashboard.getRange('A3:C12').values = [
  ['Показатель', 'Значение', 'Комментарий'],
  ['Дата базы', '', 'Settings.as_of_date'],
  ['Деньги для жизни', '', 'Только Accounts.include_in_cashflow = TRUE'],
  ['Инвестиции отдельно', '', 'Акции/облигации не участвуют в дневном лимите'],
  ['Потрачено в текущем цикле', '', 'Transactions между current_cycle_start и current_cycle_end'],
  ['Дней до 15-го', '', 'Для текущей ситуации до зарплаты'],
  ['Можно тратить в день', '', 'Фактический cashflow / дней до поступления'],
  ['Операций сохранено', '', 'Количество строк Transactions'],
  ['Нужно проверить категорию', '', 'Старые неоднозначные кафе-операции'],
  ['Открытых вопросов месяца', '', 'MonthlyReview.status = open'],
];
dashboard.getRange('B4:B12').formulas = [
  ['=Settings!B3'],
  ['=SUMIF(Accounts!E:E,TRUE,Accounts!D:D)'],
  ['=SUMIFS(Accounts!D:D,Accounts!C:C,"investment")'],
  ['=SUMIFS(Transactions!I:I,Transactions!C:C,"expense",Transactions!B:B,">="&Settings!B9,Transactions!B:B,"<"&Settings!B10)'],
  ['=MAX(1,ROUNDUP(Settings!B10-Settings!B3,0))'],
  ['=B5/B8'],
  ['=COUNTA(Transactions!A2:A1000)'],
  ['=SUMPRODUCT(--(Transactions!K2:K1000=TRUE))'],
  ['=COUNTIF(MonthlyReview!H:H,"open")'],
];
dashboard.getRange('A3:C3').format = { fill: '#111827', font: { color: '#FFFFFF', bold: true } };
dashboard.getRange('A:C').format.columnWidthPx = 260;
dashboard.getRange('B5:B10').format.numberFormat = '#,##0 ₽;[Red]-#,##0 ₽;-';
dashboard.getRange('B4').format.numberFormat = 'yyyy-mm-dd hh:mm';
dashboard.freezePanes.freezeRows(3);

const checks = workbook.worksheets.add('Checks');
checks.getRange('A1:E1').values = [['check_id', 'actual', 'expected', 'status', 'notes']];
checks.getRange('A2:E8').values = [
  ['transaction_count', '', input.transactions.length, '', 'Все старые операции должны быть перенесены'],
  ['transaction_amount_total', '', round(sum(input.transactions.map((tx) => tx.amount))), '', 'Сумма исходных операций'],
  ['missing_transaction_id', '', 0, '', 'Не должно быть пустых id'],
  ['cashflow_balance', '', 1580, '', 'Фактический остаток на ВТБ'],
  ['investment_balance', '', 153000, '', 'Акции/облигации отдельно'],
  ['open_monthly_questions', '', 6, '', 'Ожидаемо есть вопросы для ручного ввода'],
  ['review_needed_transactions', '', '', '', 'Не ошибка: операции, где нужно подтвердить еду/досуг'],
];
checks.getRange('B2:B8').formulas = [
  ['=COUNTA(Transactions!A2:A1000)'],
  ['=SUM(Transactions!I2:I1000)'],
  ['=COUNTBLANK(Transactions!A2:A1000)-COUNTBLANK(Transactions!B2:B1000)'],
  ['=SUMIF(Accounts!A:A,"vtb_main",Accounts!D:D)'],
  ['=SUMIF(Accounts!A:A,"brokerage",Accounts!D:D)'],
  ['=COUNTIF(MonthlyReview!H:H,"open")'],
  ['=SUMPRODUCT(--(Transactions!K2:K1000=TRUE))'],
];
checks.getRange('D2:D7').formulas = [
  ['=IF(B2=C2,"OK","CHECK")'],
  ['=IF(ROUND(B3,2)=ROUND(C3,2),"OK","CHECK")'],
  ['=IF(B4=C4,"OK","CHECK")'],
  ['=IF(B5=C5,"OK","CHECK")'],
  ['=IF(B6=C6,"OK","CHECK")'],
  ['=IF(B7=C7,"OK","CHECK")'],
];
checks.getRange('D8').values = [['INFO']];
checks.getRange('A1:E1').format = { fill: '#111827', font: { color: '#FFFFFF', bold: true } };
checks.getRange('A:E').format.columnWidthPx = 210;
checks.getRange('B3:C6').format.numberFormat = '#,##0 ₽;[Red]-#,##0 ₽;-';
checks.freezePanes.freezeRows(1);

await fs.mkdir(path.dirname(OUTPUT_XLSX), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(OUTPUT_XLSX);

function sum(values) {
  return values.reduce((acc, value) => acc + Number(value || 0), 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
}
