import Decimal from 'decimal.js';
Decimal.set({ precision: 40 });

export const sum = (rows, key = 'amount') =>
  rows.reduce((total, row) => total.plus(row[key] || 0), new Decimal(0));
export function money(value = 0) {
  const [integer, fraction] = new Decimal(value).toFixed(2).split('.');
  return `₹${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}
export const date = (value) => (value ? new Date(value.endsWith('Z') ? value : `${value}Z`) : null);
export const dateTime = (value) =>
  date(value)?.toLocaleString('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) || '—';
export const dayKey = (value) => date(value)?.toISOString().slice(0, 10);
export function recentFirst(a, b) {
  const time = (date(b.createdAt)?.getTime() || 0) - (date(a.createdAt)?.getTime() || 0);
  return time || (BigInt(a.id) < BigInt(b.id) ? 1 : BigInt(a.id) > BigInt(b.id) ? -1 : 0);
}
export function inRange(row, days, now = new Date()) {
  if (days === 'all') return true;
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - Number(days) + 1);
  return date(row.createdAt) >= cutoff && date(row.createdAt) <= now;
}
export function summarize(snapshot, days = 'all') {
  const transactions = snapshot.transactions.filter((row) => inRange(row, days)).sort(recentFirst);
  const ids = new Set(transactions.map((row) => row.id));
  const assessments = snapshot.alerts.filter((alert) => ids.has(alert.transactionId));
  const flagged = assessments.filter((alert) => alert.riskScore >= 40);
  const risk = [
    {
      name: 'No alert · 0–39',
      value: assessments.filter((a) => a.riskScore < 40).length,
      color: '#14a38b',
    },
    {
      name: 'Review · 40–69',
      value: assessments.filter((a) => a.riskScore >= 40 && a.riskScore < 70).length,
      color: '#e5a33c',
    },
    {
      name: 'High · 70–100',
      value: assessments.filter((a) => a.riskScore >= 70).length,
      color: '#df6372',
    },
  ];
  const grouped = new Map();
  transactions.forEach((row) => {
    const day = dayKey(row.createdAt);
    const bucket = grouped.get(day) || {
      day,
      credit: new Decimal(0),
      debit: new Decimal(0),
      count: 0,
    };
    bucket[row.type === 'CREDIT' ? 'credit' : 'debit'] = bucket[
      row.type === 'CREDIT' ? 'credit' : 'debit'
    ].plus(row.amount);
    bucket.count++;
    grouped.set(day, bucket);
  });
  const trend = [...grouped.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((row) => ({ ...row, credit: row.credit.toNumber(), debit: row.debit.toNumber() }));
  return {
    transactions,
    assessments,
    flagged,
    risk,
    trend,
    total: sum(transactions),
    credits: sum(transactions.filter((row) => row.type === 'CREDIT')),
    debits: sum(transactions.filter((row) => row.type === 'DEBIT')),
    open: flagged.filter((alert) => ['OPEN', 'IN_REVIEW'].includes(alert.status)).length,
    pending: transactions.length - assessments.length,
  };
}
