import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardList,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/resources';
import { useResource } from '../hooks/useResource';
import { dateTime, money } from '../lib/finance';
import {
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Panel,
  RiskBadge,
  StatusBadge,
} from '../components/ui';

function ReviewForm({ alert, onSaved }) {
  const [values, setValues] = useState({ status: 'IN_REVIEW', analyst: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const update = (event) => {
    setValues((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    setSuccess(false);
  };
  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      if (!values.analyst.trim() || !values.notes.trim())
        throw new Error('Enter your analyst name and investigation notes.');
      await api.review(alert.id, {
        ...values,
        analyst: values.analyst.trim(),
        notes: values.notes.trim(),
      });
      setSuccess(true);
      setValues((previous) => ({ ...previous, notes: '' }));
      onSaved();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <ErrorNotice error={error} />
      {success && (
        <p className="success-inline" role="status">
          <Check size={17} />
          Review saved to the audit trail.
        </p>
      )}
      <Field label="Investigation status" error={error?.fields?.status}>
        {(props) => (
          <select {...props} name="status" value={values.status} onChange={update}>
            {['OPEN', 'IN_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE'].map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field
        label="Analyst name"
        hint="Recorded with this review. Local workspace; no identity verification."
        error={error?.fields?.analyst}
      >
        {(props) => (
          <input
            {...props}
            name="analyst"
            value={values.analyst}
            onChange={update}
            required
            maxLength={100}
            autoComplete="name"
          />
        )}
      </Field>
      <Field label="Investigation notes" error={error?.fields?.notes}>
        {(props) => (
          <textarea
            {...props}
            name="notes"
            value={values.notes}
            onChange={update}
            required
            maxLength={1000}
            rows={5}
            placeholder="Document your findings and reasoning…"
          />
        )}
      </Field>
      <Button disabled={busy} type="submit" className="w-full">
        {busy ? <LoaderCircle className="spin" size={17} /> : <ClipboardList size={17} />}
        {busy ? 'Saving review…' : 'Save investigation review'}
      </Button>
      <p className="form-note">
        Reviews append to the audit trail. They never reverse or block ledger transactions.
      </p>
    </form>
  );
}

export default function Investigation({ id, onChanged }) {
  const resource = useResource(
    async (signal) => {
      const [alert, reviews] = await Promise.all([api.alert(id, signal), api.reviews(id, signal)]);
      const transaction = await api.transaction(alert.transactionId, signal);
      return { alert, reviews, transaction };
    },
    [id],
  );
  if (resource.loading && !resource.data)
    return <Loading label="Loading assessment and audit trail…" />;
  if (!resource.data) return <ErrorNotice error={resource.error} retry={resource.reload} />;
  const { alert, reviews, transaction } = resource.data;
  return (
    <>
      <a className="text-link back-link" href="#/alerts">
        <ArrowLeft size={16} />
        Back to anomaly alerts
      </a>
      <ErrorNotice error={resource.error} retry={resource.reload} />
      <div className="investigation-grid">
        <div>
          <Panel
            title={`Assessment ALT-${alert.id}`}
            subtitle={`Transaction #${alert.transactionId} · detected ${dateTime(alert.detectedAt)} UTC`}
            action={
              <Button variant="secondary" onClick={resource.reload} disabled={resource.loading}>
                <RefreshCw size={15} />
                Refresh
              </Button>
            }
          >
            <div className="assessment-summary">
              <div>
                <span className="eyebrow">INVESTIGATION PRIORITY</span>
                <div className="big-risk">
                  {alert.riskScore}
                  <span>/ 100</span>
                </div>
                <StatusBadge status={alert.status} />
              </div>
              <div className="score-breakdown">
                <div>
                  <span>Rule score</span>
                  <strong>{alert.ruleScore} / 100</strong>
                </div>
                <div>
                  <span>ML score percentile</span>
                  <strong>
                    {alert.mlScore === null ? 'Not available' : `${alert.mlScore} / 100`}
                  </strong>
                </div>
                <div>
                  <span>ML service</span>
                  <Badge tone={alert.mlStatus === 'AVAILABLE' ? 'green' : 'neutral'}>
                    {alert.mlStatus}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="assessment-disclaimer">
              <ShieldCheck size={18} />
              <p>
                This score prioritizes investigation. It is not a calibrated fraud probability or
                proof of fraud.
              </p>
            </div>
            <div className="detail-section inset">
              <h3>Why this transaction was assessed</h3>
              <ul className="reason-list">
                {alert.triggeredRules.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {alert.modelVersion && <p className="model-version">Model: {alert.modelVersion}</p>}
            </div>
            <dl className="detail-grid inset">
              <div>
                <dt>Amount</dt>
                <dd className="detail-money">{money(transaction.amount)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>
                  <StatusBadge status={transaction.type} />
                </dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>#{transaction.accountId}</dd>
              </div>
              <div>
                <dt>Posted · UTC</dt>
                <dd>{dateTime(transaction.createdAt)}</dd>
              </div>
              <div>
                <dt>Earlier customer debits</dt>
                <dd>{alert.features.prior_debit_count}</dd>
              </div>
              <div>
                <dt>Historical mean debit</dt>
                <dd>{money(alert.features.baseline_mean)}</dd>
              </div>
              <div>
                <dt>Account postings in 5 minutes</dt>
                <dd>{alert.features.frequency_5m}</dd>
              </div>
              <div>
                <dt>Event hour · UTC</dt>
                <dd>{alert.features.hour}:00</dd>
              </div>
            </dl>
          </Panel>
          <Panel
            title="Review history"
            subtitle="Append-only investigation audit trail"
            className="mt-panel"
          >
            {reviews.length ? (
              <ol className="review-timeline">
                {[...reviews].reverse().map((review) => (
                  <li key={review.id}>
                    <span className="timeline-dot">
                      <Check size={13} />
                    </span>
                    <div className="review-heading">
                      <strong>{review.analyst}</strong>
                      <time>{dateTime(review.reviewedAt)} UTC</time>
                    </div>
                    <div className="review-transition">
                      <StatusBadge status={review.previousStatus} />
                      <span>→</span>
                      <StatusBadge status={review.status} />
                    </div>
                    <p>{review.notes}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title="No reviews yet">
                The first analyst review will start this audit trail.
              </Empty>
            )}
          </Panel>
        </div>
        <Panel title="Analyst review" subtitle="Add context. Record a clear decision.">
          {alert.riskScore >= 40 ? (
            <div className="review-form">
              <ReviewForm
                alert={alert}
                onSaved={() => {
                  resource.reload();
                  onChanged();
                }}
              />
            </div>
          ) : (
            <Empty title="No investigation required">
              This assessment did not reach the alert threshold of 40.
            </Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
