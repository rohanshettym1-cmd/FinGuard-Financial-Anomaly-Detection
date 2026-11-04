import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Clock3,
  ScanLine,
  SearchCheck,
} from 'lucide-react';
import { ActivityChart, RiskChart, VolumeChart } from '../components/Charts';
import { Badge, Empty, Panel, RiskBadge, StatusBadge, Table } from '../components/ui';
import { dateTime, money, summarize } from '../lib/finance';

export default function Overview({ snapshot, days, onRecord, analytics = false }) {
  const data = summarize(snapshot, days);
  const byTransaction = new Map(data.assessments.map((alert) => [alert.transactionId, alert]));
  const kpis = [
    {
      title: 'Transaction volume',
      value: money(data.total),
      icon: CircleDollarSign,
      className: 'blue',
      note: 'Gross credits + debits',
    },
    {
      title: 'Total transactions',
      value: data.transactions.length.toLocaleString(),
      icon: Activity,
      className: 'purple',
      note: `${snapshot.accounts.length} accounts in workspace`,
    },
    {
      title: 'Flagged anomalies',
      value: data.flagged.length.toLocaleString(),
      icon: ScanLine,
      className: 'amber',
      note: 'Risk score of 40 or above',
    },
    {
      title: 'Open investigations',
      value: data.open.toLocaleString(),
      icon: SearchCheck,
      className: 'teal',
      note: 'Open + in review',
    },
  ];
  return (
    <>
      <div className="kpi-grid">
        {kpis.map(({ title, value, icon: Icon, className, note }) => (
          <section className="kpi" key={title}>
            <div className="kpi-top">
              <span>{title}</span>
              <span className={`kpi-icon ${className}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="kpi-value">{value}</strong>
            <p>{note}</p>
          </section>
        ))}
      </div>
      <div className="flow-strip">
        <span>
          <ArrowDownLeft size={17} className="positive" />
          Total credits <strong>{money(data.credits)}</strong>
        </span>
        <span>
          <ArrowUpRight size={17} className="muted-blue" />
          Total debits <strong>{money(data.debits)}</strong>
        </span>
        <span>
          <Clock3 size={16} />
          Awaiting assessment <strong>{data.pending}</strong>
        </span>
      </div>
      <div className="chart-grid">
        <ActivityChart trend={data.trend} />
        <RiskChart risk={data.risk} pending={data.pending} />
      </div>
      {analytics ? (
        <>
          <VolumeChart trend={data.trend} />
          <div className="method-note">
            <strong>How to read this view</strong>
            <p>
              All figures use the selected posting period and complete API pages loaded in this
              snapshot. Monetary totals use decimal arithmetic; chart coordinates are approximate
              visual representations. Risk distribution excludes pending assessments. Scores are
              investigation priorities, not calibrated fraud probabilities.
            </p>
          </div>
        </>
      ) : (
        <div className="bottom-grid">
          <Panel
            title="Recent transactions"
            subtitle="Latest posted activity in this period"
            action={
              <a href="#/transactions" className="text-link">
                View all <ArrowRight size={14} />
              </a>
            }
          >
            <Table
              caption="Recent transactions"
              rows={data.transactions.slice(0, 6)}
              columns={[
                {
                  key: 'id',
                  label: 'Transaction',
                  render: (row) => (
                    <button className="record-link" onClick={() => onRecord('transaction', row.id)}>
                      <span
                        className={`transaction-icon ${row.type === 'CREDIT' ? 'credit' : 'debit'}`}
                      >
                        {row.type === 'CREDIT' ? (
                          <ArrowDownLeft size={16} />
                        ) : (
                          <ArrowUpRight size={16} />
                        )}
                      </span>
                      <span>
                        <strong>TXN-{row.id}</strong>
                        <small>Account #{row.accountId}</small>
                      </span>
                    </button>
                  ),
                },
                { key: 'type', label: 'Type', render: (row) => <StatusBadge status={row.type} /> },
                {
                  key: 'amount',
                  label: 'Amount',
                  align: 'right',
                  render: (row) => <strong className="money-cell">{money(row.amount)}</strong>,
                },
                {
                  key: 'risk',
                  label: 'Risk',
                  render: (row) => <RiskBadge score={byTransaction.get(row.id)?.riskScore} />,
                },
              ]}
            />
          </Panel>
          <Panel
            title="Priority alerts"
            subtitle="Highest risk scores in this period"
            action={
              <a href="#/alerts" className="subtle-arrow" aria-label="View all anomaly alerts">
                <ArrowUpRight size={19} />
              </a>
            }
          >
            {data.flagged.length ? (
              <div className="priority-list">
                {[...data.flagged]
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .slice(0, 4)
                  .map((alert) => (
                    <a href={`#/alerts/${alert.id}`} key={alert.id}>
                      <span className={`priority-dot ${alert.riskScore >= 70 ? 'high' : 'review'}`}>
                        <ScanLine size={17} />
                      </span>
                      <div>
                        <strong>Transaction #{alert.transactionId}</strong>
                        <small>
                          {alert.triggeredRules
                            .find((reason) => !reason.startsWith('RULE_ONLY'))
                            ?.split(':')[0]
                            .replaceAll('_', ' ') || 'Anomaly signal'}
                        </small>
                        <span>{dateTime(alert.detectedAt)} UTC</span>
                      </div>
                      <RiskBadge score={alert.riskScore} />
                    </a>
                  ))}
              </div>
            ) : (
              <Empty title="No flagged alerts">
                Completed assessments below the threshold stay out of the investigation queue.
              </Empty>
            )}
            <div className="panel-footnote">
              <Badge tone="blue">RULES + ISOLATION FOREST</Badge>
              <p>Explainable signals. Human-led decisions.</p>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
