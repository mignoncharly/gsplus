import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Info, RotateCcw, Search } from 'lucide-react';

import { searchAdminReservations } from '../lib/api';
import { formatBusinessDateTime } from '../lib/business-time';
import { statusLabel } from '../lib/status-labels';
import './AdminReservationsPanel.css';

const RESERVATION_STATUSES = ['PENDING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'REJECTED', 'EXPIRED'];
const PAYMENT_STATUSES = ['NONE', 'PENDING', 'PAYMENT_INFO_REQUIRED', 'VERIFICATION_BLOCKED', 'VERIFIED', 'PAID', 'REJECTED', 'REFUND_PENDING', 'REFUNDED'];
const PAGE_SIZE = 25;

const pill = (status) => <span className={`admin-pill pill-${String(status).toLowerCase()}`}>{statusLabel(status)}</span>;

const contactOf = (reservation) => {
  const snapshot = reservation.snapshot;
  return snapshot
    ? { name: `${snapshot.firstName} ${snapshot.lastName}`, phone: snapshot.notificationPhoneE164 }
    : { name: `${reservation.customer?.firstName ?? ''} ${reservation.customer?.lastName ?? ''}`.trim(), phone: reservation.customer?.phone ?? '—' };
};

/**
 * Filters live in the URL query string, so a filtered list is shareable, survives a
 * reload and can be linked to from a dashboard counter (§2.1 and ADM-01).
 */
const filtersFromParams = (params) => ({
  q: params.get('q') || '',
  status: params.getAll('status'),
  payment: params.getAll('payment'),
  from: params.get('from') || '',
  to: params.get('to') || '',
  sort: params.get('sort') || 'startAt',
  direction: params.get('direction') || 'desc',
  offset: Number(params.get('offset') || 0),
});

const AdminReservationsPanel = ({ onOpenReservation, busyActions }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [error, setError] = useState('');
  const [loadedKey, setLoadedKey] = useState(null);

  const queryKey = searchParams.toString();
  // Loading is exactly "the results on screen do not answer the current query", so it
  // is derived rather than stored, and no state is set synchronously in the effect.
  const loading = loadedKey !== queryKey;

  useEffect(() => {
    let cancelled = false;
    searchAdminReservations({ ...filtersFromParams(new URLSearchParams(queryKey)), limit: PAGE_SIZE })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setMeta(result.meta);
        setError('');
        setLoadedKey(queryKey);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError.message || 'Impossible de charger les réservations.');
        setLoadedKey(queryKey);
      });
    return () => { cancelled = true; };
  }, [queryKey]);

  const applyFilters = useCallback((next) => {
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    for (const status of next.status) params.append('status', status);
    for (const payment of next.payment) params.append('payment', payment);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    if (next.sort && next.sort !== 'startAt') params.set('sort', next.sort);
    if (next.direction && next.direction !== 'desc') params.set('direction', next.direction);
    if (next.offset) params.set('offset', String(next.offset));
    setSearchParams(params);
  }, [setSearchParams]);

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    applyFilters({
      q: String(form.get('q') || '').trim(),
      status: form.getAll('status').map(String),
      payment: form.getAll('payment').map(String),
      from: String(form.get('from') || ''),
      to: String(form.get('to') || ''),
      sort: String(form.get('sort') || 'startAt'),
      direction: String(form.get('direction') || 'desc'),
      offset: 0,
    });
  };

  const activeFilterCount = filters.status.length + filters.payment.length
    + (filters.q ? 1 : 0) + (filters.from ? 1 : 0) + (filters.to ? 1 : 0);

  const pages = Math.max(1, Math.ceil((meta.total || 0) / PAGE_SIZE));
  const page = Math.floor((meta.offset || 0) / PAGE_SIZE) + 1;
  const goToPage = (offset) => applyFilters({ ...filters, offset: Math.max(0, offset) });

  return (
    <>
      <div className="admin-page-header">
        <h1>Toutes les <span>Réservations</span></h1>
      </div>

      <form className="admin-card admin-reservation-filters" onSubmit={submit} key={queryKey}>
        <div className="admin-reservation-search">
          <label htmlFor="reservation-q">Rechercher</label>
          <input id="reservation-q" name="q" type="search" className="form-input" defaultValue={filters.q}
            placeholder="Référence, nom, téléphone, e-mail, pack ou code de transaction" />
        </div>

        <fieldset className="admin-filter-group">
          <legend>Statut de la réservation</legend>
          {RESERVATION_STATUSES.map((status) => (
            <label key={status} className="admin-filter-chip">
              <input type="checkbox" name="status" value={status} defaultChecked={filters.status.includes(status)} />
              <span>{statusLabel(status)}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="admin-filter-group">
          <legend>Statut du paiement</legend>
          {PAYMENT_STATUSES.map((status) => (
            <label key={status} className="admin-filter-chip">
              <input type="checkbox" name="payment" value={status} defaultChecked={filters.payment.includes(status)} />
              <span>{status === 'NONE' ? 'Aucun paiement' : statusLabel(status)}</span>
            </label>
          ))}
        </fieldset>

        <div className="admin-filter-row">
          <div>
            <label htmlFor="reservation-from">Séance du</label>
            <input id="reservation-from" name="from" type="date" className="form-input" defaultValue={filters.from} />
          </div>
          <div>
            <label htmlFor="reservation-to">au</label>
            <input id="reservation-to" name="to" type="date" className="form-input" defaultValue={filters.to} />
          </div>
          <div>
            <label htmlFor="reservation-sort">Trier par</label>
            <select id="reservation-sort" name="sort" className="form-input" defaultValue={filters.sort}>
              <option value="startAt">Date de séance</option>
              <option value="createdAt">Date de création</option>
              <option value="reference">Référence</option>
            </select>
          </div>
          <div>
            <label htmlFor="reservation-direction">Ordre</label>
            <select id="reservation-direction" name="direction" className="form-input" defaultValue={filters.direction}>
              <option value="desc">Décroissant</option>
              <option value="asc">Croissant</option>
            </select>
          </div>
        </div>

        <div className="admin-action-row">
          <button type="submit" className="btn btn-primary"><Search size={15} /> Filtrer</button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/reservations')}>
            <RotateCcw size={15} /> Réinitialiser
          </button>
          {activeFilterCount > 0 && <span className="admin-filter-count">{activeFilterCount} filtre(s) actif(s)</span>}
        </div>
      </form>

      {error && <div className="admin-feedback error" role="alert">{error}</div>}

      <div className="admin-card">
        <div className="admin-finance-summary" aria-live="polite">
          <strong>{meta.total} réservation(s)</strong>
          <span>Page {page} / {pages}</span>
        </div>

        {loading && items.length === 0 && <p className="admin-table-empty">Chargement…</p>}
        {!loading && items.length === 0 && <p className="admin-table-empty">Aucune réservation ne correspond à ces filtres.</p>}

        {items.length > 0 && (
          <>
            {/* Table on wide screens. */}
            <div className="admin-table-wrap admin-reservation-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Référence publique</th><th>Date & Heure</th><th>Client</th>
                    <th>Pack Sélectionné</th><th>Statut</th><th>Paiement</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((reservation) => {
                    const payment = reservation.payments?.[0];
                    const contact = contactOf(reservation);
                    return (
                      <tr key={reservation.id}>
                        <td><code className="admin-public-reference">{reservation.reference}</code></td>
                        <td>{formatBusinessDateTime(reservation.startAt)}
                          {reservation.scheduleKind === 'CUSTOM_PROPOSAL' && <small className="text-gold">Proposition non bloquante</small>}
                        </td>
                        <td><strong>{contact.name}</strong><small>{contact.phone}</small></td>
                        <td>{reservation.package?.name}</td>
                        <td>{pill(reservation.status)}</td>
                        <td>{payment ? pill(payment.status) : pill('AUCUN')}</td>
                        <td>
                          <button className="btn btn-primary admin-sm-btn" onClick={() => onOpenReservation(reservation)}
                            disabled={Boolean(busyActions?.[`reservations:detail:${reservation.id}`])}>
                            <Info size={14} /> Détails
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards on a phone: the essentials and one primary action, with no
                horizontal scrolling (ADM-03). */}
            <ul className="admin-reservation-cards">
              {items.map((reservation) => {
                const payment = reservation.payments?.[0];
                const contact = contactOf(reservation);
                return (
                  <li key={reservation.id} className="admin-reservation-card">
                    <div className="admin-reservation-card__head">
                      <code className="admin-public-reference">{reservation.reference}</code>
                      <span className="admin-reservation-card__pills">
                        {pill(reservation.status)}{payment ? pill(payment.status) : pill('AUCUN')}
                      </span>
                    </div>
                    <p className="admin-reservation-card__client"><strong>{contact.name}</strong><span>{contact.phone}</span></p>
                    <p className="admin-reservation-card__meta">
                      {formatBusinessDateTime(reservation.startAt)} · {reservation.package?.name}
                    </p>
                    <button className="btn btn-primary admin-sm-btn" onClick={() => onOpenReservation(reservation)}
                      disabled={Boolean(busyActions?.[`reservations:detail:${reservation.id}`])}>
                      {/* The same action keeps the same name at every width: a control
                          that renames itself by viewport is confusing to operators and
                          to assistive technology alike. */}
                      <Info size={14} /> Détails
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="admin-pagination">
          <button className="btn btn-secondary admin-sm-btn" type="button" disabled={page <= 1}
            onClick={() => goToPage((meta.offset || 0) - PAGE_SIZE)}>Précédent</button>
          <button className="btn btn-secondary admin-sm-btn" type="button" disabled={page >= pages}
            onClick={() => goToPage((meta.offset || 0) + PAGE_SIZE)}>Suivant</button>
        </div>
      </div>
    </>
  );
};

export default AdminReservationsPanel;
