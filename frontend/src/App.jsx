import { Component, lazy, Suspense, useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { loadSnapshot } from './api/resources';
import { useResource } from './hooks/useResource';
import Layout, { navigation } from './components/Layout';
import { Button, Empty, ErrorNotice, Loading } from './components/ui';
import { CreateDialog } from './components/Forms';
import RecordDialog from './components/RecordDialog';
const Overview = lazy(() => import('./pages/Overview'));
import Directory from './pages/Directory';
import Transactions from './pages/Transactions';
import Alerts from './pages/Alerts';
import Investigation from './pages/Investigation';

class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="fatal-error">
        <ShieldCheck size={35} />
        <h1>FinGuard needs a refresh</h1>
        <p>
          The dashboard encountered an unexpected display error. Your ledger data has not been
          changed.
        </p>
        <Button onClick={() => window.location.reload()}>Reload dashboard</Button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function useRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const change = () => setHash(window.location.hash);
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  return { path: path || 'overview', query: new URLSearchParams(query) };
}

function Dashboard() {
  const { path, query } = useRoute();
  const snapshot = useResource((signal) => loadSnapshot(undefined, signal));
  const [days, setDays] = useState('all');
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    document.title = `${navigation.find((item) => item.path === path)?.label || 'Investigation'} · FinGuard`;
  }, [path]);
  const current = path.startsWith('alerts/') ? 'alerts' : path;
  const headings = {
    overview: ['Overview', 'Your financial activity, in focus.'],
    analytics: ['Analytics', 'Understand the patterns behind your ledger.'],
    customers: ['Customers', 'A clear view of every customer relationship.'],
    accounts: ['Accounts', 'Manage accounts and keep balances in view.'],
    transactions: ['Transactions', 'Trace every credit and debit with confidence.'],
    alerts: ['Anomaly alerts', 'Explainable signals. Prioritized for human review.'],
    investigations: ['Investigations', 'Turn risk signals into documented decisions.'],
  };
  const [title, subtitle] = path.startsWith('alerts/')
    ? ['Investigation details', 'Evidence, context and an accountable review trail.']
    : headings[path] || ['Page not found', 'Choose a workspace section from the navigation.'];
  const data = snapshot.data;
  const flaggedOpen =
    data?.alerts.filter(
      (alert) => alert.riskScore >= 40 && ['OPEN', 'IN_REVIEW'].includes(alert.status),
    ).length || 0;
  function created(kind, record) {
    setModal(kind === 'transaction' ? { record: 'transaction', id: record.id } : null);
    setNotice(
      `${kind[0].toUpperCase()}${kind.slice(1)} #${record.id} ${kind === 'transaction' ? 'posted successfully. Detection runs separately; refresh to see new assessments.' : 'created successfully.'}`,
    );
    snapshot.reload();
  }
  return (
    <Layout
      current={current}
      health={snapshot.error ? 'STALE' : data?.health.status}
      fetchedAt={data?.fetchedAt}
      alerts={flaggedOpen}
    >
      <div className="page-header">
        <div>
          <span className="eyebrow">FINANCIAL MONITORING</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="page-actions">
          {['overview', 'analytics'].includes(path) && (
            <div className="period-select">
              <CalendarDays size={16} />
              <select
                aria-label="Dashboard period"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              >
                <option value="all">All available history</option>
                <option value="30">Last 30 days</option>
                <option value="7">Last 7 days</option>
              </select>
            </div>
          )}
          <Button
            variant="secondary"
            onClick={snapshot.reload}
            disabled={snapshot.loading}
            aria-label="Refresh workspace"
          >
            <RefreshCw size={16} className={snapshot.loading ? 'spin' : ''} />
            <span>Refresh</span>
          </Button>
          {path === 'overview' && (
            <Button onClick={() => setModal({ create: 'transaction' })} disabled={!data}>
              <Plus size={17} />
              New transaction
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <div className="notice" role="status">
          <CheckCircle2 size={20} />
          <p>{notice}</p>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={17} />
          </button>
        </div>
      )}
      <ErrorNotice error={snapshot.error} retry={snapshot.reload} />
      {snapshot.error && data && (
        <p className="stale-note">
          Showing the last successful snapshot. Refresh failed; these figures may be out of date.
        </p>
      )}
      {!data ? (
        snapshot.loading ? (
          <Loading label="Connecting to your financial workspace…" />
        ) : (
          <Empty title="Workspace data is unavailable">
            Start the backend and check the API configuration, then try refreshing.
          </Empty>
        )
      ) : (
        <>
          {['overview', 'analytics'].includes(path) && (
            <Suspense fallback={<Loading label="Loading analytics charts…" />}>
              <Overview
                snapshot={data}
                days={days}
                onRecord={(record, id) => setModal({ record, id })}
                analytics={path === 'analytics'}
              />
            </Suspense>
          )}
          {['customers', 'accounts'].includes(path) && (
            <Directory
              key={path}
              kind={path}
              snapshot={data}
              onCreate={(create) => setModal({ create })}
              onRecord={(record, id) => setModal({ record, id })}
            />
          )}
          {path === 'transactions' && (
            <Transactions
              key={query.get('accountId') || 'all'}
              snapshot={data}
              initialAccount={query.get('accountId') || ''}
              onCreate={(create) => setModal({ create })}
              onRecord={(record, id) => setModal({ record, id })}
            />
          )}
          {['alerts', 'investigations'].includes(path) && (
            <Alerts key={path} snapshot={data} investigations={path === 'investigations'} />
          )}
          {/^alerts\/\d+$/.test(path) && (
            <Investigation key={path} id={path.split('/')[1]} onChanged={snapshot.reload} />
          )}
          {!headings[path] && !/^alerts\/\d+$/.test(path) && (
            <Empty title="This page could not be found">
              <a className="text-link" href="#/overview">
                Return to overview
              </a>
            </Empty>
          )}
        </>
      )}
      {modal?.create && data && (
        <CreateDialog
          kind={modal.create}
          snapshot={data}
          onClose={() => setModal(null)}
          onSuccess={created}
        />
      )}
      {modal?.record && (
        <RecordDialog
          key={`${modal.record}-${modal.id}`}
          kind={modal.record}
          id={modal.id}
          onClose={() => setModal(null)}
        />
      )}
    </Layout>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
