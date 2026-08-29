import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Inbox, Plug, TrendingUp, Wallet } from 'lucide-react';

import { getAdminDashboard } from '../lib/api';
import { formatBusinessDate } from '../lib/business-time';
import { formatFcfa } from '../lib/display-formatters';
import './AdminOverviewPanel.css';

/**
 * The report's §14 mock-up: what needs a decision first, statistics last. Every card
 * is a link to the list it counts, and the count comes from the same predicate that
 * list uses, so the two cannot disagree.
 */
const ZONES = [
  { key: 'toHandle', title: 'À traiter', icon: AlertTriangle, action: 'Ouvrir la file filtrée', tone: 'urgent' },
  { key: 'today', title: 'Aujourd’hui', icon: CalendarDays, action: 'Ouvrir le dossier', tone: 'today' },
  { key: 'finance', title: 'Finances', icon: Wallet, action: 'Traiter la tâche', tone: 'finance' },
  { key: 'integrations', title: 'Intégrations', icon: Plug, action: 'Tester ou relancer', tone: 'integration' },
  { key: 'requests', title: 'Demandes reçues', icon: Inbox, action: 'Lire et marquer en cours', tone: 'requests' },
];

const QueueCard = ({ entry, action, tone }) => (
  <Link to={entry.href} className={`admin-queue-card admin-queue-card--${tone} ${entry.count === 0 ? 'is-clear' : ''}`}>
    <span className="admin-queue-count">{entry.count}</span>
    <span className="admin-queue-label">{entry.label}</span>
    <span className="admin-queue-action">{entry.count === 0 ? 'Rien à traiter' : action}</span>
  </Link>
);

const AdminOverviewPanel = ({ apiStatus }) => {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');

  // State is set from the request's own callback and guarded against unmount, so a
  // slow response cannot write into a panel the operator has already left.
  useEffect(() => {
    let cancelled = false;
    getAdminDashboard()
      .then((data) => {
        if (cancelled) return;
        setDashboard(data);
        setError('');
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || 'Impossible de charger le tableau de bord.');
      });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="admin-feedback error" role="alert">{error}</div>;
  if (!dashboard) return <div className="admin-card">Chargement du tableau de bord…</div>;
  // A malformed payload must degrade to a message, never take the whole shell down
  // with it: the navigation is the operator's only way out of a broken view.
  if (!dashboard.summary) {
    return <div className="admin-feedback error" role="alert">Le tableau de bord est indisponible pour le moment.</div>;
  }

  const { revenue } = dashboard.summary;
  // "Aujourd'hui" lists the day's sessions, which are information rather than work
  // waiting on a decision, so it is shown but not counted as a backlog.
  const ACTIONABLE_ZONES = ['toHandle', 'finance', 'integrations', 'requests'];
  const outstanding = ACTIONABLE_ZONES
    .flatMap((key) => dashboard[key] ?? [])
    .reduce((total, entry) => total + entry.count, 0);

  return (
    <>
      <div className="admin-page-header">
        <h1>À <span>traiter</span></h1>
        <p className="admin-overview-lede">
          {outstanding === 0
            ? `Aucun élément en attente. Journée du ${formatBusinessDate(dashboard.businessDate)}.`
            : `${outstanding} élément(s) en attente de traitement. Journée du ${formatBusinessDate(dashboard.businessDate)}.`}
        </p>
      </div>

      {ZONES.map(({ key, title, icon, action, tone }) => {
        const entries = dashboard[key] ?? [];
        if (entries.length === 0) return null;
        return (
          <section className="admin-card admin-queue-zone" key={key} aria-labelledby={`zone-${key}`}>
            <h2 id={`zone-${key}`}>{(() => { const Icon = icon; return <Icon size={18} aria-hidden="true" />; })()} {title}</h2>
            <div className="admin-queue-grid">
              {entries.map((entry) => <QueueCard key={entry.key} entry={entry} action={action} tone={tone} />)}
            </div>
          </section>
        );
      })}

      <section className="admin-card" aria-labelledby="zone-summary">
        <h2 id="zone-summary"><TrendingUp size={18} aria-hidden="true" /> Résumé</h2>
        <div className="admin-summary-grid">
          <div className="admin-summary-item">
            <span className="admin-summary-value">{formatFcfa(revenue.net)}</span>
            <span className="admin-summary-label">Revenu vérifié net du mois</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-value">{dashboard.summary.reservationsThisMonth}</span>
            <span className="admin-summary-label">Réservations du mois</span>
          </div>
          <div className="admin-summary-item">
            <span className="admin-summary-value">{dashboard.summary.uniqueCustomers}</span>
            <span className="admin-summary-label">Clients enregistrés</span>
          </div>
        </div>
        {/* A verified payment on a cancelled booking is not income, so the deductions
            are shown rather than folded into a single number. */}
        <dl className="admin-revenue-breakdown">
          <div><dt>Encaissé sur réservations actives</dt><dd>{formatFcfa(revenue.onActiveReservations)}</dd></div>
          <div><dt>Vérifié sur réservations annulées ou refusées</dt><dd>{formatFcfa(revenue.onCancelledReservations)}</dd></div>
          <div><dt>Remboursé ce mois</dt><dd>−{formatFcfa(revenue.refunded)}</dd></div>
        </dl>
      </section>

      <section className="admin-card" aria-labelledby="zone-system">
        <h2 id="zone-system">Statut système</h2>
        <p className={apiStatus?.state === 'online' ? 'admin-system-online' : 'admin-system-offline'}>
          {apiStatus?.message}
        </p>
      </section>
    </>
  );
};

export default AdminOverviewPanel;
