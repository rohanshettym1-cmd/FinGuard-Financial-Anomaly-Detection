import { useState } from 'react';
import { ArrowUpRight, Plus, Search } from 'lucide-react';
import { Button, Pagination, Panel, StatusBadge, Table } from '../components/ui';
import { dateTime, money } from '../lib/finance';

export default function Directory({ kind, snapshot, onCreate, onRecord }) {
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [page, setPage] = useState(0);
  const customers = kind === 'customers';
  const names = new Map(snapshot.customers.map((customer) => [customer.id, customer]));
  const source = customers ? snapshot.customers : snapshot.accounts;
  const filtered = source.filter(
    (row) =>
      (!customerId || row.customerId === customerId) &&
      [row.id, row.name, row.email, names.get(row.customerId)?.name, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search.toLowerCase())),
  );
  const columns = customers
    ? [
        {
          key: 'name',
          label: 'Customer',
          render: (row) => (
            <button className="record-link" onClick={() => onRecord('customer', row.id)}>
              <span className="customer-initial">{row.name.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{row.name}</strong>
                <small>Customer #{row.id}</small>
              </span>
            </button>
          ),
        },
        { key: 'email', label: 'Email address' },
        {
          key: 'accounts',
          label: 'Accounts',
          render: (row) =>
            snapshot.accounts.filter((account) => account.customerId === row.id).length,
        },
        { key: 'createdAt', label: 'Created · UTC', render: (row) => dateTime(row.createdAt) },
        {
          key: 'action',
          label: 'Details',
          render: (row) => (
            <button className="text-link" onClick={() => onRecord('customer', row.id)}>
              View customer <ArrowUpRight size={14} />
            </button>
          ),
        },
      ]
    : [
        {
          key: 'id',
          label: 'Account',
          render: (row) => (
            <button className="text-link" onClick={() => onRecord('account', row.id)}>
              Account #{row.id}
            </button>
          ),
        },
        {
          key: 'customerId',
          label: 'Customer',
          render: (row) => (
            <span>
              {names.get(row.customerId)?.name || `Customer #${row.customerId}`}
              <small className="cell-subtext">Customer #{row.customerId}</small>
            </span>
          ),
        },
        { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
        {
          key: 'balance',
          label: 'Current balance',
          align: 'right',
          render: (row) => <strong className="money-cell">{money(row.balance)}</strong>,
        },
        {
          key: 'action',
          label: 'Activity',
          render: (row) => (
            <a className="text-link" href={`#/transactions?accountId=${row.id}`}>
              View history <ArrowUpRight size={14} />
            </a>
          ),
        },
      ];
  return (
    <Panel
      title={customers ? 'Customer directory' : 'Account directory'}
      subtitle={`${filtered.length} ${customers ? 'customers' : 'accounts'} in this view`}
      action={
        <Button onClick={() => onCreate(customers ? 'customer' : 'account')}>
          <Plus size={16} />
          {customers ? 'Add customer' : 'Create account'}
        </Button>
      }
    >
      <div className="filter-bar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label={`Search ${kind}`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={
              customers ? 'Search name, email or ID…' : 'Search account, customer or status…'
            }
          />
        </div>
        {!customers && (
          <select
            aria-label="Filter accounts by customer"
            value={customerId}
            onChange={(event) => {
              setCustomerId(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All customers</option>
            {snapshot.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <Table
        caption={customers ? 'Customer directory' : 'Account directory'}
        rows={filtered.slice(page * 10, page * 10 + 10)}
        columns={columns}
      />
      <Pagination page={page} total={filtered.length} onChange={setPage} />
    </Panel>
  );
}
