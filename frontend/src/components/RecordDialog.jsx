import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { api } from '../api/resources';
import { useResource } from '../hooks/useResource';
import { dateTime, money } from '../lib/finance';
import { Badge, Button, Dialog, Empty, ErrorNotice, Loading, RiskBadge, StatusBadge } from './ui';

export default function RecordDialog({ kind, id, onClose }) {
  const resource = useResource(
    async (signal) => {
      if (kind === 'customer') {
        const [record, accounts] = await Promise.all([
          api.customer(id, signal),
          api.accounts(id, signal),
        ]);
        return { record, accounts };
      }
      if (kind === 'account') {
        const [record, balance] = await Promise.all([
          api.account(id, signal),
          api.balance(id, signal),
        ]);
        return { record, balance };
      }
      const [record, risk] = await Promise.all([api.transaction(id, signal), api.risk(id, signal)]);
      return { record, risk };
    },
    [kind, id],
  );
  const { data, loading, error, reload } = resource;
  return (
    <Dialog title={`${kind[0].toUpperCase()}${kind.slice(1)} #${id}`} onClose={onClose} wide>
      <ErrorNotice error={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <dl className="detail-grid">
              {kind === 'customer' ? (
                <>
                  <div>
                    <dt>Full name</dt>
                    <dd>{data.record.name}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{data.record.email}</dd>
                  </div>
                </>
              ) : kind === 'account' ? (
                <>
                  <div>
                    <dt>Customer</dt>
                    <dd>#{data.record.customerId}</dd>
                  </div>
                  <div>
                    <dt>Current balance</dt>
                    <dd className="detail-money">{money(data.balance.balance)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge status={data.record.status} />
                    </dd>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <dt>Account</dt>
                    <dd>#{data.record.accountId}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>
                      <StatusBadge status={data.record.type} />
                    </dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd className="detail-money">{money(data.record.amount)}</dd>
                  </div>
                  <div>
                    <dt>Balance after posting</dt>
                    <dd>{money(data.record.balanceAfter)}</dd>
                  </div>
                  <div className="span-full">
                    <dt>Description</dt>
                    <dd>{data.record.description || 'No description provided'}</dd>
                  </div>
                </>
              )}
              <div>
                <dt>Created at · UTC</dt>
                <dd>{dateTime(data.record.createdAt)}</dd>
              </div>
            </dl>
            {kind === 'customer' && (
              <section className="detail-section">
                <h3>
                  Customer accounts <span>{data.accounts.length}</span>
                </h3>
                {data.accounts.length ? (
                  data.accounts.map((account) => (
                    <div className="account-detail-row" key={account.id}>
                      <div>
                        <strong>Account #{account.id}</strong>
                        <StatusBadge status={account.status} />
                      </div>
                      <span>{money(account.balance)}</span>
                      <a
                        className="text-link"
                        href={`#/transactions?accountId=${account.id}`}
                        onClick={onClose}
                      >
                        History <ArrowUpRight size={14} />
                      </a>
                    </div>
                  ))
                ) : (
                  <Empty title="No accounts yet">
                    Create an account for this customer to get started.
                  </Empty>
                )}
              </section>
            )}
            {kind === 'account' && (
              <a
                className="button button-primary"
                href={`#/transactions?accountId=${id}`}
                onClick={onClose}
              >
                View transaction history <ArrowUpRight size={16} />
              </a>
            )}
            {kind === 'transaction' && (
              <section className="detail-section">
                <div className="section-title">
                  <h3>Detection assessment</h3>
                  <Button variant="secondary" onClick={reload}>
                    <RefreshCw size={14} /> Refresh
                  </Button>
                </div>
                {data.risk.status === 'PENDING' ? (
                  <div className="form-note">
                    <Badge tone="amber">Detection pending</Badge>
                    <p>
                      The posting is complete. The background worker will assess it separately.
                      Refresh in a few seconds.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="assessment-heading">
                      <RiskBadge score={data.risk.riskScore} />
                      <StatusBadge status={data.risk.status} />
                      <Badge tone={data.risk.mlStatus === 'AVAILABLE' ? 'blue' : 'neutral'}>
                        {data.risk.mlStatus === 'AVAILABLE' ? 'Rules + ML' : 'Rules only'}
                      </Badge>
                    </div>
                    <ul className="reason-list">
                      {data.risk.triggeredRules.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <a className="text-link" href={`#/alerts/${data.risk.id}`} onClick={onClose}>
                      View assessment details <ArrowUpRight size={14} />
                    </a>
                  </>
                )}
              </section>
            )}
          </>
        )
      )}
    </Dialog>
  );
}
