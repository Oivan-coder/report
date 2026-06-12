export const DEFAULT_SETTINGS = {
  currency: '₽',
  salaryDay: 15,
  advanceDay: 30,
  paydayMoveRule: 'previous-business-day',
  accounts: [
    { id: 'main', name: 'Основной счет', balance: 0 },
    { id: 'cash', name: 'Наличные', balance: 0 }
  ],
  categories: [
    { id: 'food-out', name: 'Кафе/бар/доставка', group: 'discretionary', monthlyLimit: 18000 },
    { id: 'food-home', name: 'Еда дома', group: 'base', monthlyLimit: 18000 },
    { id: 'car-fuel', name: 'Бензин', group: 'base', monthlyLimit: 14000 },
    { id: 'car-service', name: 'Текущие расходы авто', group: 'base', monthlyLimit: 10000 },
    { id: 'subscriptions', name: 'Связь/подписки/парковка', group: 'fixed', monthlyLimit: 5000 },
    { id: 'shopping', name: 'Одежда/техника/хобби', group: 'discretionary', monthlyLimit: 12000 },
    { id: 'people', name: 'Переводы людям', group: 'other', monthlyLimit: 5000 },
    { id: 'other', name: 'Прочее', group: 'other', monthlyLimit: 10000 }
  ],
  obligations: [
    { id: 'rent', name: 'Жилье/коммуналка', amount: 0, dueDay: 15, active: true },
    { id: 'phone', name: 'Связь и подписки', amount: 0, dueDay: 1, active: true }
  ],
  goals: [
    { id: 'emergency', name: 'НЗ', target: 100000, current: 0, monthlyPlan: 10000, priority: 1 },
    { id: 'car-fund', name: 'Фонд машины', target: 50000, current: 0, monthlyPlan: 5000, priority: 2 },
    { id: 'vacation', name: 'Отпуск', target: 80000, current: 0, monthlyPlan: 5000, priority: 3 }
  ]
};

export function toMoney(value, currency = '₽') {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value || 0)) + ' ' + currency;
}

export function parseDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function movePayday(date, rule = 'previous-business-day') {
  const d = new Date(date);
  const day = d.getDay();
  if (day !== 0 && day !== 6) return d;
  if (rule === 'previous-business-day') {
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return d;
  }
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

export function getCycleBoundaries(today = new Date(), settings = DEFAULT_SETTINGS) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const paydays = [];
  for (let m = month - 1; m <= month + 2; m += 1) {
    const y = new Date(year, m, 1).getFullYear();
    const mm = new Date(year, m, 1).getMonth();
    paydays.push(movePayday(new Date(y, mm, settings.salaryDay), settings.paydayMoveRule));
    paydays.push(movePayday(new Date(y, mm, settings.advanceDay), settings.paydayMoveRule));
  }
  paydays.sort((a, b) => a - b);
  const todayStart = startOfDay(today);
  let start = paydays[0];
  let next = paydays[paydays.length - 1];
  for (let i = 0; i < paydays.length - 1; i += 1) {
    if (startOfDay(paydays[i]) <= todayStart && todayStart < startOfDay(paydays[i + 1])) {
      start = paydays[i];
      next = paydays[i + 1];
      break;
    }
  }
  return { start: startOfDay(start), end: startOfDay(next), daysLeft: diffDays(todayStart, startOfDay(next)) || 1 };
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(a, b) {
  return Math.max(0, Math.ceil((b - a) / 86400000));
}

export function calculateDashboard(transactions, settings = DEFAULT_SETTINGS, today = new Date()) {
  const cycle = getCycleBoundaries(today, settings);
  const cycleTx = transactions.filter((t) => {
    const d = parseDate(t.date);
    return d >= cycle.start && d < cycle.end;
  });
  const expenses = cycleTx.filter((t) => t.type !== 'income');
  const income = cycleTx.filter((t) => t.type === 'income');
  const totalSpent = expenses.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalIncome = income.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const baseAccountBalance = settings.accounts
    .filter((a) => a.includeInCashflow !== false)
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const accountBalance = settings.accountBalanceMode === 'current'
    ? baseAccountBalance
    : baseAccountBalance + totalIncome - totalSpent;

  const futureObligations = settings.obligations
    .filter((o) => o.active)
    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
  const plannedGoals = settings.goals.reduce((sum, g) => sum + Number(g.monthlyPlan || 0), 0);
  const freeMoney = accountBalance - futureObligations - plannedGoals;
  const dailyLimit = freeMoney / cycle.daysLeft;
  const elapsedDays = Math.max(1, diffDays(cycle.start, startOfDay(today)) + 1);
  const burnRate = totalSpent / elapsedDays;
  const forecastBalance = freeMoney - burnRate * cycle.daysLeft;

  const byCategory = groupByCategory(expenses, settings.categories);
  return { cycle, accountBalance, totalSpent, totalIncome, futureObligations, plannedGoals, freeMoney, dailyLimit, burnRate, forecastBalance, byCategory };
}

function groupByCategory(expenses, categories) {
  const map = new Map(categories.map((c) => [c.name, { ...c, spent: 0 }]));
  for (const tx of expenses) {
    const name = tx.category || 'Прочее';
    if (!map.has(name)) map.set(name, { id: name, name, group: 'other', monthlyLimit: 0, spent: 0 });
    map.get(name).spent += Number(tx.amount || 0);
  }
  return Array.from(map.values())
    .filter((c) => c.spent > 0 || c.monthlyLimit > 0)
    .sort((a, b) => b.spent - a.spent);
}
