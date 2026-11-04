import { useState } from 'react';
import Decimal from 'decimal.js';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { api } from '../api/resources';
import { Button, Dialog, ErrorNotice, Field } from './ui';

export function CreateDialog({ kind, snapshot, onClose, onSuccess }) {
  const [values, setValues] = useState({
    name: '',
    email: '',
    customerId: snapshot.customers[0]?.id || '',
    accountId: snapshot.accounts.find((account) => account.status === 'ACTIVE')?.id || '',
    status: 'ACTIVE',
    type: 'CREDIT',
    amount: '',
    description: '',
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = (event) =>
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const title = {
    customer: 'Create customer',
    account: 'Create account',
    transaction: 'New transaction',
  }[kind];
  async function submit(event) {
    event.preventDefault();
    const validation = {};
    if (kind === 'customer') {
      if (!values.name.trim()) validation.name = 'Enter a customer name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
        validation.email = 'Enter a valid email address.';
    }
    if (kind === 'account' && !values.customerId)
      validation.customerId = 'Choose a customer first.';
    if (kind === 'transaction') {
      if (!values.accountId) validation.accountId = 'Choose an active account.';
      if (!/^\d{1,17}(\.\d{1,2})?$/.test(values.amount) || new Decimal(values.amount || 0).lte(0))
        validation.amount = 'Enter a positive amount with up to 17 integer digits and 2 decimals.';
    }
    setErrors(validation);
    setError(null);
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      const body =
        kind === 'customer'
          ? { name: values.name.trim(), email: values.email.trim() }
          : kind === 'account'
            ? { customerId: values.customerId, status: values.status }
            : {
                accountId: values.accountId,
                type: values.type,
                amount: values.amount,
                description: values.description.trim() || null,
              };
      const action = {
        customer: api.createCustomer,
        account: api.createAccount,
        transaction: api.createTransaction,
      }[kind];
      const result = await action(body);
      onSuccess(kind, result);
    } catch (failure) {
      setError(failure);
      setErrors(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={title}
      description={
        kind === 'transaction'
          ? 'Post a credit or debit to the ledger. Amounts are in INR.'
          : kind === 'account'
            ? 'New accounts start with a zero balance.'
            : 'Add a customer to your monitoring workspace.'
      }
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} noValidate>
        <ErrorNotice error={error} />
        {kind === 'customer' && (
          <>
            <Field label="Full name" error={errors.name}>
              {(props) => (
                <input
                  {...props}
                  name="name"
                  value={values.name}
                  onChange={update}
                  maxLength={100}
                  autoComplete="name"
                  required
                  placeholder="e.g. Demo Asha"
                />
              )}
            </Field>
            <Field label="Email address" error={errors.email}>
              {(props) => (
                <input
                  {...props}
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={update}
                  maxLength={254}
                  autoComplete="email"
                  required
                  placeholder="name@example.test"
                />
              )}
            </Field>
          </>
        )}
        {kind === 'account' && (
          <>
            <Field label="Customer" error={errors.customerId}>
              {(props) => (
                <select
                  {...props}
                  name="customerId"
                  value={values.customerId}
                  onChange={update}
                  required
                >
                  <option value="">Select customer</option>
                  {snapshot.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · #{customer.id}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Account status">
              {(props) => (
                <select {...props} name="status" value={values.status} onChange={update}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              )}
            </Field>
            <p className="form-note">Balances change only through posted credits and debits.</p>
          </>
        )}
        {kind === 'transaction' && (
          <>
            <Field label="Account" error={errors.accountId}>
              {(props) => (
                <select
                  {...props}
                  name="accountId"
                  value={values.accountId}
                  onChange={update}
                  required
                >
                  <option value="">Select account</option>
                  {snapshot.accounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                      disabled={account.status !== 'ACTIVE'}
                    >
                      Account #{account.id} ·{' '}
                      {
                        snapshot.customers.find((customer) => customer.id === account.customerId)
                          ?.name
                      }{' '}
                      {account.status === 'INACTIVE' ? '(inactive)' : ''}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="form-grid">
              <Field label="Transaction type" error={errors.type}>
                {(props) => (
                  <select {...props} name="type" value={values.type} onChange={update}>
                    <option value="CREDIT">Credit · add funds</option>
                    <option value="DEBIT">Debit · remove funds</option>
                  </select>
                )}
              </Field>
              <Field label="Amount (INR)" error={errors.amount}>
                {(props) => (
                  <input
                    {...props}
                    name="amount"
                    value={values.amount}
                    onChange={update}
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                  />
                )}
              </Field>
            </div>
            <Field label="Description (optional)" error={errors.description}>
              {(props) => (
                <textarea
                  {...props}
                  name="description"
                  value={values.description}
                  onChange={update}
                  rows={3}
                  maxLength={255}
                  placeholder="A short description of this posting"
                />
              )}
            </Field>
            <p className="form-note">
              Posting is final in this workspace. Detection runs afterward and never changes the
              balance. Do not resubmit an interrupted request without checking the ledger.
            </p>
          </>
        )}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}
            {busy ? 'Saving…' : kind === 'transaction' ? 'Post transaction' : title}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
