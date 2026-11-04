import { useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { Badge, Pagination, Panel, RiskBadge, StatusBadge, Table } from '../components/ui';
import { dateTime } from '../lib/finance';

export default function Alerts({ snapshot, investigations = false }) {
  const [status, setStatus] = useState(investigations ? 'IN_REVIEW' : '');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(0);
  const rows = snapshot.alerts
    .filter(
      (alert) =>
        alert.riskScore >= 40 &&
        (!status || alert.status === status) &&
        (!source ||
          (source === 'hybrid'
            ? alert.mlStatus === 'AVAILABLE'
            : alert.mlStatus !== 'AVAILABLE')) &&
        `${alert.id} ${alert.transactionId} ${alert.triggeredRules.join(' ')}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.riskScore - a.riskScore || (BigInt(a.id) < BigInt(b.id) ? 1 : -1));
  return (
    <Panel
      title={investigations ? 'Investigation queue' : 'Anomaly alert feed'}
      subtitle="Prioritized by risk score · assessments at or above 40"
    >
      <div className="filter-bar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Search anomaly alerts"
            placeholder="Search alert, transaction or signal…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="Filter investigation status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(0);
          }}
        >
          <option value="">All investigation statuses</option>
          {['OPEN', 'IN_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE'].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter detection source"
          value={source}
          onChange={(event) => {
            setSource(event.target.value);
            setPage(0);
          }}
        >
          <option value="">All detection sources</option>
          <option value="hybrid">Rules + ML available</option>
          <option value="rules">Rules only / fallback</option>
        </select>
      </div>
      <Table
        caption="Anomaly alerts and investigations"
        rows={rows.slice(page * 10, page * 10 + 10)}
        columns={[
          {
            key: 'id',
            label: 'Alert',
            render: (row) => (
              <a className="text-link" href={`#/alerts/${row.id}`}>
                ALT-{row.id}
              </a>
            ),
          },
          {
            key: 'transactionId',
            label: 'Transaction',
            render: (row) => (
              <span>
                <strong>TXN-{row.transactionId}</strong>
                <small className="cell-subtext signal-preview">
                  {row.triggeredRules
                    .filter((reason) => !reason.startsWith('RULE_ONLY'))
                    .map((reason) => reason.split(':')[0].replaceAll('_', ' '))
                    .join(' · ')}
                </small>
              </span>
            ),
          },
          {
            key: 'riskScore',
            label: 'Risk score',
            render: (row) => <RiskBadge score={row.riskScore} />,
          },
          {
            key: 'source',
            label: 'Detection',
            render: (row) => (
              <Badge tone={row.mlStatus === 'AVAILABLE' ? 'blue' : 'neutral'}>
                {row.mlStatus === 'AVAILABLE' ? 'Rules + ML' : 'Rules only'}
              </Badge>
            ),
          },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'detectedAt', label: 'Detected · UTC', render: (row) => dateTime(row.detectedAt) },
          {
            key: 'action',
            label: 'Investigation',
            render: (row) => (
              <a className="text-link" href={`#/alerts/${row.id}`}>
                Investigate <ArrowUpRight size={14} />
              </a>
            ),
          },
        ]}
      />
      <Pagination page={page} total={rows.length} onChange={setPage} />
    </Panel>
  );
}
