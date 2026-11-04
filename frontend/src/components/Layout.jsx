import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Menu,
  ScanLine,
  SearchCheck,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

export const navigation = [
  { path: 'overview', label: 'Overview', icon: LayoutDashboard },
  { path: 'customers', label: 'Customers', icon: Users },
  { path: 'accounts', label: 'Accounts', icon: CreditCard },
  { path: 'transactions', label: 'Transactions', icon: Activity },
  { path: 'alerts', label: 'Anomaly alerts', icon: ScanLine, group: true },
  { path: 'investigations', label: 'Investigations', icon: SearchCheck },
  { path: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
];

function Navigation({ current, alerts, onNavigate }) {
  return (
    <>
      <a href="#/overview" className="brand" onClick={onNavigate}>
        <span className="brand-mark">
          <ShieldCheck size={25} strokeWidth={1.8} />
        </span>
        <span>
          FinGuard<span className="brand-dot">.</span>
          <small>FINANCIAL INTELLIGENCE</small>
        </span>
      </a>
      <div className="workspace-select">
        <span className="workspace-avatar">F</span>
        <div>
          <strong>FinGuard workspace</strong>
          <small>Local environment</small>
        </div>
        <ChevronRight size={14} />
      </div>
      <nav aria-label="Main navigation">
        <p className="nav-label">WORKSPACE</p>
        {navigation.map(({ path, label, icon: Icon, group }) => (
          <div key={path}>
            {group && <p className="nav-label risk-label">RISK OPERATIONS</p>}
            <a
              href={`#/${path}`}
              onClick={onNavigate}
              className={`nav-link ${current === path || current.startsWith(`${path}/`) ? 'active' : ''}`}
              aria-current={current === path ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{label}</span>
              {path === 'alerts' && alerts > 0 && <b className="nav-count">{alerts}</b>}
            </a>
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <ShieldCheck size={20} />
          <strong>Context before conclusions.</strong>
          <p>Risk scores prioritize investigation. They do not prove fraud.</p>
        </div>
        <a
          className="sidebar-docs"
          href="https://github.com/rohanshettym1-cmd/FinGuard-Financial-Anomaly-Detection#readme"
          target="_blank"
          rel="noreferrer"
        >
          <CircleHelp size={17} /> Workspace guide <ArrowUpRight size={15} />
        </a>
        <div className="workspace-user">
          <span>FG</span>
          <div>
            <strong>Analyst workspace</strong>
            <small>Local development · INR / UTC</small>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Layout({ current, health, fetchedAt, alerts, children }) {
  const [menu, setMenu] = useState(false);
  const dialog = useRef(null);
  useEffect(() => {
    if (menu) dialog.current.showModal();
    else dialog.current.close();
  }, [menu]);
  const section =
    navigation.find((item) => current === item.path || current.startsWith(`${item.path}/`))
      ?.label || 'Workspace';
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Navigation current={current} alerts={alerts} />
      </aside>
      <dialog
        className="mobile-nav"
        ref={dialog}
        onCancel={() => setMenu(false)}
        aria-label="Navigation"
      >
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        >
          <X size={22} />
        </button>
        <Navigation current={current} alerts={alerts} onNavigate={() => setMenu(false)} />
      </dialog>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${health === 'UP' ? '' : 'connection-offline'}`}>
              <i />
              {health === 'UP' ? 'API connected' : 'API not connected'}
            </span>
            <span className="topbar-divider" />
            <span className="avatar">FG</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
          <footer className="main-footer">
            <span>
              FinGuard <b>·</b> Financial transaction intelligence
            </span>
            <span>
              {fetchedAt
                ? `Snapshot refreshed ${fetchedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Waiting for API data'}{' '}
              <b>·</b> All transaction times UTC
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
