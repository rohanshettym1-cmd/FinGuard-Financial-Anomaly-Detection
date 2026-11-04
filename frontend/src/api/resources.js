import { request } from './client';

export function createApi(call = request) {
  const id = (value) => encodeURIComponent(String(value));
  const query = (values) =>
    new URLSearchParams(
      Object.entries(values).filter(([, value]) => value !== '' && value !== undefined),
    ).toString();
  async function pages(path, params, signal) {
    const rows = [];
    for (let page = 0; ; page++) {
      const result = await call(`${path}?${query({ ...params, page, size: 100 })}`, { signal });
      rows.push(...result.content);
      if (page + 1 >= result.totalPages) return rows;
      // Fail visibly instead of silently presenting a truncated portfolio as complete.
      if (page >= 999)
        throw new Error(
          'This dataset exceeds the local dashboard limit of 100,000 rows per feed. Narrow the data in the backend before loading.',
        );
    }
  }
  return {
    health: (signal) => call('/health', { signal }),
    customers: (signal) => call('/customers', { signal }),
    customer: (value, signal) => call(`/customers/${id(value)}`, { signal }),
    accounts: (customerId, signal) => call(`/accounts?${query({ customerId })}`, { signal }),
    account: (value, signal) => call(`/accounts/${id(value)}`, { signal }),
    balance: (value, signal) => call(`/accounts/${id(value)}/balance`, { signal }),
    transactions: (accountId, signal) => pages('/transactions', { accountId }, signal),
    transaction: (value, signal) => call(`/transactions/${id(value)}`, { signal }),
    risk: (value, signal) => call(`/transactions/${id(value)}/risk`, { signal }),
    alerts: (signal) => pages('/alerts', { includeNormal: true }, signal),
    alert: (value, signal) => call(`/alerts/${id(value)}`, { signal }),
    reviews: (value, signal) => call(`/alerts/${id(value)}/reviews`, { signal }),
    createCustomer: (body) => call('/customers', { method: 'POST', body }),
    createAccount: (body) => call('/accounts', { method: 'POST', body }),
    createTransaction: (body) => call('/transactions', { method: 'POST', body }),
    review: (value, body) => call(`/alerts/${id(value)}/reviews`, { method: 'POST', body }),
  };
}

export const api = createApi();

// Bound concurrent requests rather than firing one request for every customer at once.
export async function mapLimited(items, task, limit = 4) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(items.length, limit) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await task(items[index]);
      }
    }),
  );
  return results;
}

export async function loadSnapshot(client = api, signal) {
  const [health, customers, alerts] = await Promise.all([
    client.health(signal),
    client.customers(signal),
    client.alerts(signal),
  ]);
  const accounts = (
    await mapLimited(customers, (customer) => client.accounts(customer.id, signal))
  ).flat();
  const transactions = (
    await mapLimited(accounts, (account) => client.transactions(account.id, signal))
  ).flat();
  return { health, customers, accounts, transactions, alerts, fetchedAt: new Date() };
}
