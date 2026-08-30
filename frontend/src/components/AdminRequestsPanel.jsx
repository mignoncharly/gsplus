import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Mail, MessageCircle, Phone, Search } from 'lucide-react';

import { adminRequestsExportUrl, searchAdminRequests } from '../lib/api';
import { formatBusinessDateTime } from '../lib/business-time';
import { notificationTypeDescriptor, statusLabel } from '../lib/status-labels';
import './AdminRequestsPanel.css';

const TYPES = ['CONTACT', 'B2B', 'QUOTE', 'CREATIVE'];
// The report's four statuses. WON and LOST are the pipeline it does not want; historical
// rows still read correctly through statusLabel, but nothing offers them.
const STATUSES = ['NEW', 'IN_PROGRESS', 'HANDLED', 'ARCHIVED'];

const filtersFromParams = (params) => ({
  q: params.get('q') || '',
  type: params.getAll('type'),
  status: params.getAll('status'),
  from: params.get('from') || '',
  to: params.get('to') || '',
});

const digitsOnly = (value) => String(value || '').replace(/[^\d+]/g, '');

/**
 * One unreadable date must not take the whole list down with it.
 *
 * `formatBusinessDateTime` throws on an invalid value, and it is called once per request,
 * so a single malformed row would blank the panel rather than showing the other requests
 * with one gap in it.
 */
const businessDateTime = (value) => {
  if (!value) return null;
  try {
    return formatBusinessDateTime(value);
  } catch {
    return null;
  }
};

/**
 * §7 — Demandes reçues.
 *
 * Explicitly not a CRM: the report rules out assignment, pipeline, opportunity value,
 * automated follow-up and conversion measurement. This is a list the studio searches,
 * works through, and closes, with the contact details and the e-mail history it needs to
 * answer without leaving the record.
 */
const AdminRequestsPanel = ({ refreshToken, cardRefs, openActionDialog, runAction }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  // A link in an already-delivered e-mail points at /admin/demandes/<référence>. That
  // path must keep resolving, so the reference in it becomes the search term rather than
  // the URL being rewritten to a query the e-mail never carried.
  const pathReference = location.pathname.split('/')[3] || '';
  const filters = useMemo(() => {
    const parsed = filtersFromParams(searchParams);
    return pathReference && !parsed.q ? { ...parsed, q: pathReference } : parsed;
  }, [searchParams, pathReference]);
  const queryKey = `${searchParams.toString()}|${pathReference}`;

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0 });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    searchAdminRequests({ ...filters, limit: 50 })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setMeta(result.meta);
        setError('');
      })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Impossible de charger les demandes.'); });
    return () => { cancelled = true; };
    // `refreshToken` is the dashboard's own refresh clock. Without it, a panel that
    // fetches its own rows would ignore the "Actualiser" button entirely.
  }, [queryKey, reloadToken, refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (next) => {
    const params = new URLSearchParams();
    if (next.q) params.set('q', next.q);
    for (const type of next.type) params.append('type', type);
    for (const status of next.status) params.append('status', status);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    setSearchParams(params);
  };

  const setStatus = (lead, status) => openActionDialog({
    title: `${statusLabel(status)} — ${lead.reference}`,
    summary: `${lead.company || lead.name}${lead.subject ? ` · ${lead.subject}` : ''}`,
    consequence: status === 'HANDLED'
      ? 'La demande est marquée traitée, avec la date et l’auteur.'
      : 'Le statut change ; rien n’est envoyé au demandeur.',
    confirmLabel: statusLabel(status),
    fields: [],
    onConfirm: async () => {
      const ok = await runAction(`Demande ${lead.reference}`, () => import('../lib/api').then((api) => api.updateAdminLead(lead.id, { status })), true);
      if (ok) setReloadToken((current) => current + 1);
    },
  });

  const editNote = (lead) => openActionDialog({
    title: `Note interne — ${lead.reference}`,
    summary: lead.company || lead.name,
    consequence: 'La note reste interne au studio ; le demandeur ne la voit jamais.',
    confirmLabel: 'Enregistrer la note',
    fields: [{ name: 'internalNote', label: 'Note', type: 'textarea', rows: 5, defaultValue: lead.internalNote || '' }],
    onConfirm: async (values) => {
      const ok = await runAction(`Note ${lead.reference}`, () => import('../lib/api').then((api) =>
        api.updateAdminLead(lead.id, { internalNote: values.internalNote.trim() || null })), true);
      if (ok) setReloadToken((current) => current + 1);
    },
  });

  return (
    <>
      <div className="admin-page-header"><h1>Demandes <span>reçues</span></h1></div>

      <form
        className="admin-journal-filters admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          apply({
            q: form.get('q')?.trim() || '',
            type: form.getAll('type'),
            status: form.getAll('status'),
            from: form.get('from') || '',
            to: form.get('to') || '',
          });
        }}
      >
        <div className="admin-journal-filters__wide">
          <label htmlFor="requests-q">Rechercher</label>
          <input id="requests-q" name="q" className="form-input" defaultValue={filters.q}
            placeholder="Référence, nom, société, e-mail, téléphone ou texte du message" />
        </div>
        <fieldset>
          <legend>Type</legend>
          {TYPES.map((type) => (
            <label key={type} className="admin-check">
              <input type="checkbox" name="type" value={type} defaultChecked={filters.type.includes(type)} /> {statusLabel(type)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Statut</legend>
          {STATUSES.map((status) => (
            <label key={status} className="admin-check">
              <input type="checkbox" name="status" value={status} defaultChecked={filters.status.includes(status)} /> {statusLabel(status)}
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="requests-from">Du</label>
          <input id="requests-from" name="from" type="date" className="form-input" defaultValue={filters.from} />
        </div>
        <div>
          <label htmlFor="requests-to">Au</label>
          <input id="requests-to" name="to" type="date" className="form-input" defaultValue={filters.to} />
        </div>
        <div className="admin-action-row">
          <button type="submit" className="btn btn-primary admin-sm-btn"><Search size={13} /> Filtrer</button>
          <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => setSearchParams(new URLSearchParams())}>Réinitialiser</button>
          {/* The export is the list on screen, filters included, not the whole table. */}
          <a className="btn btn-secondary admin-sm-btn" href={adminRequestsExportUrl(filters)}>Exporter en CSV</a>
        </div>
      </form>

      <p className="admin-record-hint">{meta.total} demande{meta.total < 2 ? '' : 's'} correspondent à ce filtre.</p>
      {error && <p className="admin-action-dialog-error" role="alert">{error}</p>}

      {items.length === 0 && !error && <div className="admin-card"><p>Aucune demande ne correspond à ce filtre.</p></div>}

      {items.map((lead) => {
        const open = Boolean(expanded[lead.id]);
        const consented = Boolean(lead.whatsappConsentAt);
        return (
          <article key={lead.id} className="admin-card admin-lead-card" data-lead-reference={lead.reference} tabIndex="-1"
            ref={(element) => { if (element) cardRefs?.current?.set(lead.reference, element); else cardRefs?.current?.delete(lead.reference); }}>
            <div className="admin-lead-header">
              <div>
                <h2>{lead.company || lead.name}</h2>
                <code className="admin-public-reference">{lead.reference}</code>
                {businessDateTime(lead.createdAt) && <small>Reçue le {businessDateTime(lead.createdAt)}</small>}
                {businessDateTime(lead.handledAt) && <small>Traitée le {businessDateTime(lead.handledAt)}{lead.handledBy?.name ? ` par ${lead.handledBy.name}` : ''}</small>}
              </div>
              <div className="admin-lead-badges">
                <span className="admin-pill admin-pill--count">{statusLabel(lead.type)}</span>
                <span className={`admin-pill pill-${String(lead.status).toLowerCase()}`}>{statusLabel(lead.status)}</span>
              </div>
            </div>

            {lead.subject && <p><strong>Sujet :</strong> {lead.subject}</p>}
            <div className="admin-lead-message">{lead.message}</div>

            <dl className="admin-settings-grid">
              <div><dt>Nom</dt><dd>{lead.name}</dd></div>
              <div><dt>E-mail</dt><dd>{lead.email || 'Non communiqué'}</dd></div>
              <div><dt>Téléphone</dt><dd>{lead.phone || 'Non communiqué'}</dd></div>
              <div><dt>WhatsApp</dt><dd>{consented ? `Consenti${businessDateTime(lead.whatsappConsentAt) ? ` le ${businessDateTime(lead.whatsappConsentAt)}` : ''}` : 'Pas de consentement'}</dd></div>
            </dl>

            <div className="admin-action-row">
              {lead.phone && <a className="btn btn-secondary admin-sm-btn" href={`tel:${digitsOnly(lead.phone)}`}><Phone size={13} /> Appeler</a>}
              {lead.email && <a className="btn btn-secondary admin-sm-btn" href={`mailto:${lead.email}`}><Mail size={13} /> Écrire</a>}
              {/* WhatsApp is offered only where the demander agreed to it. */}
              {consented && lead.phone && (
                <a className="btn btn-secondary admin-sm-btn" href={`https://wa.me/${digitsOnly(lead.phone).replace('+', '')}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={13} /> WhatsApp
                </a>
              )}
              <button type="button" className="btn btn-secondary admin-sm-btn"
                aria-label={`Note interne sur la demande ${lead.reference}`} onClick={() => editNote(lead)}>
                {lead.internalNote ? 'Modifier la note' : 'Ajouter une note'}
              </button>
              {STATUSES.filter((status) => status !== lead.status).map((status) => (
                <button key={status} type="button" className="btn btn-secondary admin-sm-btn"
                  aria-label={`Marquer la demande ${lead.reference} comme ${statusLabel(status).toLowerCase()}`}
                  onClick={() => setStatus(lead, status)}>{statusLabel(status)}</button>
              ))}
              <button type="button" className="btn btn-secondary admin-sm-btn" aria-expanded={open}
                aria-label={`Historique des e-mails de la demande ${lead.reference}`}
                onClick={() => setExpanded((current) => ({ ...current, [lead.id]: !current[lead.id] }))}>
                E-mails ({lead.notifications?.length ?? 0})
              </button>
            </div>

            {lead.internalNote && <p className="admin-journal-draft"><strong>Note interne :</strong> {lead.internalNote}</p>}

            {open && (
              <ul className="admin-request-history">
                {(lead.notifications || []).length === 0 && <li>Aucun e-mail lié à cette demande.</li>}
                {(lead.notifications || []).map((event) => {
                  const descriptor = notificationTypeDescriptor(event.type);
                  return (
                    <li key={event.id}>
                      <strong>{descriptor.name}</strong> · {statusLabel(event.status)} · {event.recipient}
                      <small>{businessDateTime(event.sentAt || event.createdAt) || 'Date inconnue'}</small>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        );
      })}
    </>
  );
};

export default AdminRequestsPanel;
