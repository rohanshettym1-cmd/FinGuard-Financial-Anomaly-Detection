import { useEffect, useId, useRef } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, LoaderCircle, X } from 'lucide-react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function StatusBadge({ status }) {
  const tone = {
    ACTIVE: 'green',
    CREDIT: 'green',
    INACTIVE: 'neutral',
    DEBIT: 'blue',
    OPEN: 'red',
    IN_REVIEW: 'amber',
    CONFIRMED: 'red',
    FALSE_POSITIVE: 'green',
    NOT_REQUIRED: 'neutral',
  }[status];
  return <Badge tone={tone}>{status?.replaceAll('_', ' ') || 'Pending'}</Badge>;
}
export function RiskBadge({ score }) {
  return score === undefined || score === null ? (
    <Badge>Pending</Badge>
  ) : (
    <span
      className={`risk-score ${score >= 70 ? 'risk-high' : score >= 40 ? 'risk-review' : 'risk-low'}`}
    >
      <i />
      {score}
      <span>/ 100</span>
    </span>
  );
}
export function Empty({ title = 'Nothing here yet', children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={26} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({ label = 'Loading workspace data…' }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorNotice({ error, retry }) {
  if (!error) return null;
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>Something needs your attention</strong>
        <p>{error.message || String(error)}</p>
      </div>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Field({ label, error, hint, children, className = '' }) {
  const id = useId();
  // Render-prop fields keep each label, input and validation message connected.
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children({
        id,
        'aria-invalid': !!error,
        'aria-describedby': error || hint ? `${id}-help` : undefined,
      })}
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? 'field-error' : 'field-hint'}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function Dialog({ title, description, children, onClose, busy = false, wide = false }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    (dialog.querySelector('input, select, textarea') || dialog.querySelector('button'))?.focus();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = [
          ...ref.current.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
          ),
        ];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !busy) onClose();
      }}
    >
      <div className="dialog-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}>
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Table({
  columns,
  rows,
  rowKey = 'id',
  caption,
  empty = 'No matching records',
  onRowClick,
}) {
  if (!rows.length)
    return <Empty title={empty}>Try adjusting your filters, or create your first record.</Empty>;
  return (
    <div
      className="table-wrap"
      role="region"
      tabIndex={0}
      aria-label={`${caption} (scroll horizontally if needed)`}
    >
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.align === 'right' ? 'text-right' : ''}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'text-right' : ''}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pagination({ page, total, size = 10, onChange }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages - 1);
  return (
    <div className="pagination">
      <p>
        {total
          ? `${current * size + 1}–${Math.min((current + 1) * size, total)} of ${total}`
          : '0 records'}
      </p>
      <div>
        <Button
          variant="secondary"
          disabled={current === 0}
          onClick={() => onChange(current - 1)}
          aria-label="Previous page"
        >
          <ArrowLeft size={15} />
        </Button>
        <span>
          Page {current + 1} of {pages}
        </span>
        <Button
          variant="secondary"
          disabled={current >= pages - 1}
          onClick={() => onChange(current + 1)}
          aria-label="Next page"
        >
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
