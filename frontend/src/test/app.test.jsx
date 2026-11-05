import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

vi.mock('../components/Charts', () => ({
  ActivityChart: () => <div>Transaction activity chart</div>,
  RiskChart: () => <div>Risk distribution chart</div>,
  VolumeChart: () => <div>Transaction volume chart</div>,
}));
const customer = {
  id: 1,
  name: 'Synthetic Customer',
  email: 'synthetic@example.test',
  createdAt: '2026-01-01T09:00:00',
};
const account = {
  id: 2,
  customerId: 1,
  status: 'ACTIVE',
  balance: 100.1,
  createdAt: '2026-01-01T09:01:00',
};
const transaction = {
  id: 3,
  accountId: 2,
  type: 'CREDIT',
  amount: 100.1,
  balanceAfter: 100.1,
  createdAt: '2026-01-01T09:02:00',
};
function mockApi(empty = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      const parsed = new URL(url);
      const result =
        parsed.pathname === '/api/health'
          ? { status: 'UP' }
          : parsed.pathname === '/api/customers'
            ? empty
              ? []
              : [customer]
            : parsed.pathname === '/api/accounts'
              ? [account]
              : parsed.pathname === '/api/transactions'
                ? { content: [transaction], totalPages: 1 }
                : parsed.pathname === '/api/alerts'
                  ? { content: [], totalPages: 0 }
                  : null;
      return new Response(JSON.stringify(result), { status: result ? 200 : 404 });
    }),
  );
}
describe('dashboard API integration states', () => {
  beforeEach(() => {
    window.location.hash = '#/overview';
  });
  it('renders totals from account transaction pages and navigates to real customer data', async () => {
    mockApi();
    render(<App />);
    // The first overview render loads a lazy module; allow cold Windows CI imports to finish.
    expect(await screen.findByText('Total transactions', {}, { timeout: 5000 })).toBeVisible();
    expect(screen.getAllByText('₹100.10').length).toBeGreaterThan(0);
    expect(screen.getByText('API connected')).toBeVisible();
    await userEvent.click(screen.getAllByRole('link', { name: 'Customers' })[0]);
    expect(await screen.findByText('synthetic@example.test')).toBeVisible();
    expect(fetch.mock.calls.some(([url]) => url.includes('/accounts?customerId=1'))).toBe(true);
    expect(
      fetch.mock.calls.some(([url]) => url.includes('/transactions?accountId=2&page=0&size=100')),
    ).toBe(true);
  });
  it('shows an empty workspace without inventing transactions', async () => {
    mockApi(true);
    render(<App />);
    expect(await screen.findByText('No flagged alerts')).toBeVisible();
    expect(screen.getByText('No matching records')).toBeVisible();
    expect(screen.getAllByText('₹0.00').length).toBeGreaterThan(0);
  });
  it('reports failed API loading and allows a successful retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the API');
    mockApi();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Total transactions')).toBeVisible();
  });
});
