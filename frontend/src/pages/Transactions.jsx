import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { ArrowDownLeft, ArrowUpRight, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Button, Pagination, Panel, RiskBadge, StatusBadge, Table } from '../components/ui';
import { dayKey, dateTime, money, recentFirst } from '../lib/finance';

export default function Transactions({ snapshot, initialAccount = '', onCreate, onRecord }) {
  const [filters, setFilters] = useState({
    account: initialAccount,
    type: '',
    search: '',
    from: '',
    to: '',
    minimum: '',
  });
  const [page, setPage] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const update = (event) => {
    setFilters((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setPage(0);
  };
  const assessments = new Map(snapshot.alerts.map((alert) => [alert.transactionId, alert]));
  const minimumValid = !filters.minimum || /^\d+(\.\d{0,2})?$/.test(filters.minimum);
  const rows = useMemo(
    () =>
      snapshot.transactions
        .filter(
          (row) =>
            (!filters.account || row.accountId === filters.account) &&
            (!filters.type || row.type === filters.type) &&
            (!filters.from || dayKey(row.createdAt) >= filters.from) &&
            (!filters.to || dayKey(row.createdAt) <= filters.to) &&
            (!filters.minimum || (minimumValid && new Decimal(row.amount).gte(filters.minimum))) &&
            [row.id, row.accountId, row.description]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(filters.search.toLowerCase())),
        )
        .sort(recentFirst),
    [snapshot.transactions, filters, minimumValid],
  );
  return (
    <Panel
      title="Transaction ledger"
      subtitle="Posted credits and debits · amounts in INR"
      action={
        <Button onClick={() => onCreate('transaction')}>
          <Plus size={16} />
          New transaction
        </Button>
      }
    >
      <div className="filter-bar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search transactions"
            name="search"
            placeholder="Search ID, account or description…"
            value={filters.search}
            onChange={update}
          />
        </div>
        <select
          aria-label="Filter transactions by account"
          name="account"
          value={filters.account}
          onChange={update}
        >
          <option value="">All accounts</option>
          {snapshot.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              Account #{account.id}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter transaction type"
          name="type"
          value={filters.type}
          onChange={update}
        >
          <option value="">All types</option>
          <option value="CREDIT">Credits</option>
          <option value="DEBIT">Debits</option>
        </select>
        <Button
          variant="secondary"
          onClick={() => setAdvanced((value) => !value)}
          aria-expanded={advanced}
        >
          <SlidersHorizontal size={16} />
          Filters
        </Button>
      </div>
      {advanced && (
        <div className="advanced-filters">
          <label>
            From date · UTC
            <input name="from" type="date" value={filters.from} onChange={update} />
          </label>
          <label>
            To date · UTC
            <input name="to" type="date" min={filters.from} value={filters.to} onChange={update} />
          </label>
          <label>
            Minimum amount · INR
            <input
              name="minimum"
              inputMode="decimal"
              value={filters.minimum}
              onChange={update}
              aria-invalid={!minimumValid}
              placeholder="0.00"
            />
            {!minimumValid && <span className="field-error">Enter a valid decimal amount.</span>}
          </label>
          <Button
            variant="ghost"
            onClick={() => {
              setFilters({ account: '', type: '', search: '', from: '', to: '', minimum: '' });
              setPage(0);
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <Table
        caption="Filtered transaction history"
        rows={rows.slice(page * 10, page * 10 + 10)}
        columns={[
          {
            key: 'id',
            label: 'Transaction',
            render: (row) => (
              <button className="record-link" onClick={() => onRecord('transaction', row.id)}>
                <span className={`transaction-icon ${row.type === 'CREDIT' ? 'credit' : 'debit'}`}>
                  {row.type === 'CREDIT' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </span>
                <span>
                  <strong>TXN-{row.id}</strong>
                  <small className="description-preview">
                    {row.description || 'No description'}
                  </small>
                </span>
              </button>
            ),
          },
          { key: 'accountId', label: 'Account', render: (row) => `#${row.accountId}` },
          { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type} /> },
          {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            render: (row) => <strong className="money-cell">{money(row.amount)}</strong>,
          },
          { key: 'createdAt', label: 'Posted · UTC', render: (row) => dateTime(row.createdAt) },
          {
            key: 'risk',
            label: 'Risk score',
            render: (row) => <RiskBadge score={assessments.get(row.id)?.riskScore} />,
          },
        ]}
      />
      <Pagination page={page} total={rows.length} onChange={setPage} />
    </Panel>
  );
}
