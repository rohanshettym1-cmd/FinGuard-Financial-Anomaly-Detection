import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Transactions from '../pages/Transactions';
import Investigation from '../pages/Investigation';
import { api } from '../api/resources';

vi.mock('../api/resources', () => ({
  api: { alert: vi.fn(), reviews: vi.fn(), transaction: vi.fn(), review: vi.fn() },
}));
const alert = {
  id: '4',
  transactionId: '3',
  riskScore: 70,
  ruleScore: 45,
  mlScore: 98,
  mlStatus: 'AVAILABLE',
  modelVersion: 'synthetic-test',
  triggeredRules: ['LARGE_AMOUNT: synthetic signal'],
  detectedAt: '2026-01-01T10:00:00',
  status: 'OPEN',
  features: { prior_debit_count: 5, baseline_mean: '100.00', frequency_5m: 1, hour: 10 },
};
describe('ledger and analyst workflows', () => {
  beforeEach(() => vi.resetAllMocks());
  it('paginates and filters all loaded transaction records, not just the displayed page', async () => {
    const transactions = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      accountId: '2',
      type: index % 2 ? 'DEBIT' : 'CREDIT',
      amount: '10.00',
      createdAt: '2026-01-01T10:00:00',
    }));
    render(
      <Transactions
        snapshot={{ accounts: [{ id: '2' }], transactions, alerts: [] }}
        onCreate={vi.fn()}
        onRecord={vi.fn()}
      />,
    );
    expect(screen.getByText('1–10 of 12')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('11–12 of 12')).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText('Filter transaction type'), 'DEBIT');
    expect(screen.getByText('1–6 of 6')).toBeVisible();
    expect(within(screen.getByRole('table')).getAllByText('DEBIT')).toHaveLength(6);
  });
  it('saves an analyst decision through the existing review endpoint and reloads audit history', async () => {
    api.alert.mockResolvedValue(alert);
    api.reviews.mockResolvedValue([]);
    api.transaction.mockResolvedValue({
      id: '3',
      accountId: '2',
      amount: '12000',
      type: 'CREDIT',
      createdAt: '2026-01-01T10:00:00',
    });
    api.review.mockImplementation(async (id, body) => {
      api.alert.mockResolvedValue({ ...alert, status: body.status });
      api.reviews.mockResolvedValue([
        { id: '5', ...body, previousStatus: 'OPEN', reviewedAt: '2026-01-01T11:00:00' },
      ]);
      return { id: '5' };
    });
    const changed = vi.fn();
    render(<Investigation id="4" onChanged={changed} />);
    expect(await screen.findByText('Assessment ALT-4')).toBeVisible();
    await userEvent.type(screen.getByLabelText('Analyst name'), 'Demo Analyst');
    await userEvent.type(
      screen.getByLabelText('Investigation notes'),
      'Reviewed synthetic evidence.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save investigation review' }));
    await waitFor(() =>
      expect(api.review).toHaveBeenCalledWith('4', {
        status: 'IN_REVIEW',
        analyst: 'Demo Analyst',
        notes: 'Reviewed synthetic evidence.',
      }),
    );
    expect(await screen.findByText('Reviewed synthetic evidence.')).toBeVisible();
    expect(changed).toHaveBeenCalledOnce();
  });
  it('does not hide backend review errors or claim a failed review succeeded', async () => {
    api.alert.mockResolvedValue(alert);
    api.reviews.mockResolvedValue([]);
    api.transaction.mockResolvedValue({
      id: '3',
      accountId: '2',
      amount: '12000',
      type: 'CREDIT',
      createdAt: '2026-01-01T10:00:00',
    });
    api.review.mockRejectedValue(
      new Error('Account is busy; retry after checking transaction history'),
    );
    const changed = vi.fn();
    render(<Investigation id="4" onChanged={changed} />);
    await screen.findByText('Assessment ALT-4');
    await userEvent.type(screen.getByLabelText('Analyst name'), 'Demo');
    await userEvent.type(screen.getByLabelText('Investigation notes'), 'Synthetic evidence');
    await userEvent.click(screen.getByRole('button', { name: 'Save investigation review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Account is busy');
    expect(changed).not.toHaveBeenCalled();
  });
});
