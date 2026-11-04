import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateDialog } from '../components/Forms';
import { Dialog } from '../components/ui';
import { api } from '../api/resources';

vi.mock('../api/resources', () => ({
  api: { createCustomer: vi.fn(), createAccount: vi.fn(), createTransaction: vi.fn() },
}));
const snapshot = {
  customers: [{ id: '1', name: 'Synthetic Customer' }],
  accounts: [{ id: '2', customerId: '1', status: 'ACTIVE' }],
};

describe('validated creation workflows', () => {
  beforeEach(() => vi.resetAllMocks());
  it('has accessible labels and submits a customer through the API', async () => {
    const saved = vi.fn();
    api.createCustomer.mockResolvedValue({ id: '7' });
    render(
      <CreateDialog kind="customer" snapshot={snapshot} onClose={vi.fn()} onSuccess={saved} />,
    );
    await userEvent.type(screen.getByLabelText('Full name'), 'Demo Customer');
    await userEvent.type(screen.getByLabelText('Email address'), 'demo@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith('customer', { id: '7' }));
    expect(api.createCustomer).toHaveBeenCalledWith({
      name: 'Demo Customer',
      email: 'demo@example.test',
    });
  });
  it('shows backend field errors without closing the form', async () => {
    api.createCustomer.mockRejectedValue({
      message: 'Validation failed',
      fields: { email: 'Email already exists' },
    });
    render(
      <CreateDialog kind="customer" snapshot={snapshot} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText('Full name'), 'Demo');
    await userEvent.type(screen.getByLabelText('Email address'), 'demo@example.test');
    await userEvent.click(screen.getByRole('button', { name: 'Create customer' }));
    expect(await screen.findByText('Email already exists')).toBeVisible();
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true');
  });
  it('sends monetary amounts as exact decimal strings, not JavaScript floats', async () => {
    api.createTransaction.mockResolvedValue({ id: '9' });
    render(
      <CreateDialog kind="transaction" snapshot={snapshot} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText('Amount (INR)'), '99999999999999999.99');
    await userEvent.click(screen.getByRole('button', { name: 'Post transaction' }));
    await waitFor(() =>
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: '2', amount: '99999999999999999.99' }),
      ),
    );
  });
  it('rejects fractional cents without posting', async () => {
    render(
      <CreateDialog kind="transaction" snapshot={snapshot} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText('Amount (INR)'), '1.001');
    await userEvent.click(screen.getByRole('button', { name: 'Post transaction' }));
    expect(screen.getByText(/Enter a positive amount/)).toBeVisible();
    expect(api.createTransaction).not.toHaveBeenCalled();
  });
  it('creates a zero-balance account without an invented opening-balance field', async () => {
    api.createAccount.mockResolvedValue({ id: '3' });
    render(
      <CreateDialog kind="account" snapshot={snapshot} onClose={vi.fn()} onSuccess={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(api.createAccount).toHaveBeenCalledWith({ customerId: '1', status: 'ACTIVE' });
  });
  it('supports Escape/cancel handling and blocks dismissal during an in-flight posting', () => {
    const close = vi.fn();
    const view = render(
      <Dialog title="Posting" busy onClose={close}>
        Body
      </Dialog>,
    );
    screen
      .getByRole('dialog')
      .dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(close).not.toHaveBeenCalled();
    view.rerender(
      <Dialog title="Posting" onClose={close}>
        Body
      </Dialog>,
    );
    screen
      .getByRole('dialog')
      .dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    expect(close).toHaveBeenCalledOnce();
  });
});
