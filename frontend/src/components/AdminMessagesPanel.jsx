import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, RotateCcw, Search, Send, Undo2 } from 'lucide-react';

import {
  previewAdminMessage,
  publishAdminMessage,
  revertAdminMessage,
  saveAdminMessageDraft,
  searchAdminNotifications,
  testSendAdminMessage,
} from '../lib/api';
import { formatBusinessDateTime } from '../lib/business-time';
import { NOTIFICATION_AUDIENCE_LABELS, notificationTypeDescriptor, statusLabel } from '../lib/status-labels';

/** An unclassified failure still reads as something, rather than as blank. */
const notificationResolutionLabel = (code) => statusLabel(code || 'UNCLASSIFIED');
import './AdminMessagesPanel.css';

const STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'];

const filtersFromParams = (params) => ({
  channel: params.get('channel') || '',
  status: params.getAll('status'),
  type: params.get('type') || '',
  from: params.get('from') || '',
  to: params.get('to') || '',
  actionableOnly: params.get('actionableOnly') === 'true',
  includeDisabledChannels: params.get('includeDisabledChannels') === 'true',
});

/**
 * The journal (ADM-08b) and the message library (§8.1).
 *
 * Each journal row leads with what the message is in business terms; the codes,
 * provider states and attempts stay available in a panel the operator opens, rather
 * than filling the row.
 */
const AdminMessagesPanel = ({ templates, templatesMeta, onReloadTemplates, openActionDialog, runAction, onResolve, onRetry, busyActions }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const queryKey = searchParams.toString();

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hiddenChannels: [] });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let cancelled = false;
    searchAdminNotifications({ ...filtersFromParams(new URLSearchParams(queryKey)), limit: 50 })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setMeta(result.meta);
        setError('');
      })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Impossible de charger le journal.'); });
    return () => { cancelled = true; };
  }, [queryKey]);

  const apply = (next) => {
    const params = new URLSearchParams();
    if (next.channel) params.set('channel', next.channel);
    for (const status of next.status) params.append('status', status);
    if (next.type) params.set('type', next.type);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    if (next.actionableOnly) params.set('actionableOnly', 'true');
    if (next.includeDisabledChannels) params.set('includeDisabledChannels', 'true');
    setSearchParams(params);
  };

  const editTemplate = (template) => {
    const source = template.draft ?? template.published ?? template.compiled;
    openActionDialog({
      title: `Modèle ${template.code}`,
      summary: `${template.audience === 'admin' ? 'Message interne' : 'Message client'} · variables : ${template.variables.join(', ') || 'aucune'}`,
      consequence: 'Enregistrer crée un brouillon. Rien n’est envoyé différemment avant la publication.',
      confirmLabel: 'Enregistrer le brouillon',
      fields: [
        { name: 'subject', label: 'Objet', required: true, defaultValue: source.subject },
        { name: 'preheader', label: 'Aperçu court', defaultValue: source.preheader },
        { name: 'body', label: 'Contenu, une ligne par paragraphe', type: 'textarea', rows: 10, required: true,
          defaultValue: (source.body || []).join('\n') },
      ],
      preview: async (values) => {
        const result = await previewAdminMessage(template.code, {
          locale: 'fr', subject: values.subject, preheader: values.preheader,
          body: String(values.body || '').split('\n'),
        });
        return { locale: result.locale, subject: result.subject, preheader: result.preheader, text: result.text };
      },
      onConfirm: async (values) => {
        const success = await runAction(`Brouillon ${template.code}`, () => saveAdminMessageDraft(template.code, {
          locale: 'fr', subject: values.subject.trim(), preheader: values.preheader.trim(),
          body: String(values.body || '').split('\n').filter((line) => line.trim()),
        }), true);
        if (success) onReloadTemplates();
      },
    });
  };

  const simple = (title, summary, consequence, label, action) => openActionDialog({
    title, summary, consequence, confirmLabel: label, fields: [],
    onConfirm: async () => { const ok = await runAction(label, action, true); if (ok) onReloadTemplates(); },
  });

  return (
    <>
      <div className="admin-page-header"><h1>Messages & <span>journal</span></h1></div>
      {error && <div className="admin-feedback error" role="alert">{error}</div>}

      <form
        className="admin-card admin-finance-filters"
        key={queryKey}
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          apply({
            channel: String(values.get('channel') || ''),
            status: values.getAll('status').map(String),
            type: String(values.get('type') || '').trim(),
            from: String(values.get('from') || ''),
            to: String(values.get('to') || ''),
            actionableOnly: values.get('actionableOnly') === 'true',
            includeDisabledChannels: values.get('includeDisabledChannels') === 'true',
          });
        }}
      >
        <div>
          <label htmlFor="journal-channel">Canal</label>
          <select id="journal-channel" name="channel" className="form-input" defaultValue={filters.channel}>
            <option value="">Tous les canaux actifs</option>
            <option value="email">E-mail</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div>
          <label htmlFor="journal-type">Type de message</label>
          <input id="journal-type" name="type" className="form-input" defaultValue={filters.type} placeholder="ex. booking_received_customer" />
        </div>
        <div>
          <label htmlFor="journal-from">Du</label>
          <input id="journal-from" name="from" type="date" className="form-input" defaultValue={filters.from} />
        </div>
        <div>
          <label htmlFor="journal-to">au</label>
          <input id="journal-to" name="to" type="date" className="form-input" defaultValue={filters.to} />
        </div>
        <fieldset className="admin-filter-group">
          <legend>Statut</legend>
          {STATUSES.map((status) => (
            <label key={status} className="admin-filter-chip">
              <input type="checkbox" name="status" value={status} defaultChecked={filters.status.includes(status)} />
              <span>{statusLabel(status)}</span>
            </label>
          ))}
        </fieldset>
        <label className="admin-finance-overdue">
          <input name="actionableOnly" type="checkbox" value="true" defaultChecked={filters.actionableOnly} /> Anomalies exploitables uniquement
        </label>
        <label className="admin-finance-overdue">
          <input name="includeDisabledChannels" type="checkbox" value="true" defaultChecked={filters.includeDisabledChannels} /> Inclure les canaux désactivés
        </label>
        <button type="submit" className="btn btn-primary"><Search size={15} /> Filtrer</button>
      </form>

      <div className="admin-card">
        <div className="admin-finance-summary">
          <strong>{meta.total} message(s)</strong>
          {meta.hiddenChannels?.length > 0 && (
            <span className="admin-journal-hidden">
              Canal masqué car désactivé : {meta.hiddenChannels.join(', ')}
            </span>
          )}
        </div>

        {items.length === 0 ? <p className="admin-table-empty">Aucun message ne correspond à ces filtres.</p> : (
          <ul className="admin-journal">
            {items.map((item) => {
              const descriptor = notificationTypeDescriptor(item.type);
              const open = Boolean(expanded[item.id]);
              return (
                <li key={item.id} className="admin-journal-row">
                  <div className="admin-journal-head">
                    <div>
                      <strong>{descriptor.name}</strong>
                      {descriptor.audience && (
                        <span className={`admin-pill admin-pill--audience audience-${descriptor.audience.toLowerCase()}`}>
                          {NOTIFICATION_AUDIENCE_LABELS[descriptor.audience]}
                        </span>
                      )}
                      <span className={`admin-pill pill-${String(item.status).toLowerCase()}`}>{statusLabel(item.status)}</span>
                    </div>
                    <small>
                      {item.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · {item.recipient} · {formatBusinessDateTime(item.createdAt)}
                      {item.reservation?.reference ? ` · ${item.reservation.reference}` : item.lead?.reference ? ` · ${item.lead.reference}` : ''}
                    </small>
                    {descriptor.trigger && <small>{descriptor.trigger}</small>}
                    {/* How a failure was classified is operational, not technical, so it
                        stays on the business line rather than behind the toggle. */}
                    {item.resolution && (
                      <small className="admin-journal-resolution">
                        Disposition : {notificationResolutionLabel(item.resolution)}
                        {item.resolutionNote ? ` — ${item.resolutionNote}` : ''}
                        {item.resolvedAt ? ` · classée le ${formatBusinessDateTime(item.resolvedAt)}` : ''}
                      </small>
                    )}
                  </div>

                  <div className="admin-journal-actions">
                    {item.status === 'FAILED' && !item.resolution && (
                      <>
                        <button type="button" className="btn btn-secondary admin-sm-btn"
                          disabled={Boolean(busyActions?.['notifications:Classification notification'])}
                          onClick={() => onResolve(item, 'OBSOLETE')}>Classer obsolète</button>
                        <button type="button" className="btn btn-secondary admin-sm-btn"
                          disabled={Boolean(busyActions?.['notifications:Classification notification'])}
                          onClick={() => onResolve(item, 'ACTIONABLE_REVIEW_REQUIRED')}>À examiner</button>
                      </>
                    )}
                    {item.resolution === 'ACTIONABLE_REVIEW_REQUIRED' && (
                      <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => onRetry(item)}>
                        <RotateCcw size={13} /> Réessayer
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary admin-sm-btn"
                      aria-expanded={open}
                      onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))}>
                      {open ? 'Masquer le détail technique' : 'Détail technique'}
                    </button>
                  </div>

                  {open && (
                    <dl className="admin-journal-technical">
                      <div><dt>Code technique</dt><dd><code>{item.type}</code></dd></div>
                      <div><dt>Modèle</dt><dd>{item.templateCode || '—'}{item.templateVersion ? ` · v${item.templateVersion}` : ''}</dd></div>
                      <div><dt>Tentatives</dt><dd>{item.attemptCount}/{item.maxAttempts}</dd></div>
                      <div><dt>Statut fournisseur</dt><dd>{item.providerStatus || '—'}</dd></div>
                      <div><dt>Livré</dt><dd>{item.deliveredAt ? formatBusinessDateTime(item.deliveredAt) : '—'}</dd></div>
                      <div><dt>Erreur</dt><dd>{item.error || 'Aucune'}</dd></div>
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="admin-page-header"><h1>Bibliothèque de <span>messages</span></h1></div>
      <p className="admin-record-hint admin-library-note">
        Chaque modèle est celui compilé dans l’application tant qu’aucune version n’est publiée. Publier remplace le
        texte envoyé ; revenir à l’origine rétablit la version d’application sans effacer l’historique.
        {templatesMeta?.overrides ? ` ${templatesMeta.overrides.count} modèle(s) actuellement remplacé(s).` : ''}
      </p>

      {templates.map((template) => (
        <section className="admin-card" key={template.code} aria-labelledby={`tpl-${template.code}`}>
          <div className="admin-agenda-head">
            <h2 id={`tpl-${template.code}`}>
              {template.code}
              <span className={`admin-pill admin-pill--audience audience-${template.audience === 'admin' ? 'internal' : 'client'}`}>
                {template.audience === 'admin' ? 'Interne' : 'Client'}
              </span>
              {template.isOverridden && <span className="admin-pill admin-pill--count">Personnalisé</span>}
            </h2>
            <div className="admin-action-row">
              <button type="button" className="btn btn-secondary admin-sm-btn"
                aria-label={`Modifier le modèle ${template.code}`} onClick={() => editTemplate(template)}>Modifier</button>
              <button type="button" className="btn btn-secondary admin-sm-btn"
                aria-label={`Envoyer un test du modèle ${template.code}`}
                onClick={() => simple(`Envoi de test — ${template.code}`, 'Le message part vers l’adresse du studio.',
                  'Aucun client ne reçoit cet envoi.', 'Envoyer le test', () => testSendAdminMessage(template.code))}>
                <Send size={13} /> Test
              </button>
              <button type="button" className="btn btn-primary admin-sm-btn" disabled={!template.draft}
                aria-label={`Publier le modèle ${template.code}`}
                title={template.draft ? undefined : 'Aucun brouillon à publier.'}
                onClick={() => simple(`Publier — ${template.code}`, 'Le brouillon remplacera le texte envoyé.',
                  'La version précédente est conservée dans l’historique.', 'Publier', () => publishAdminMessage(template.code))}>
                Publier
              </button>
              {template.isOverridden && (
                <button type="button" className="btn btn-secondary admin-sm-btn"
                  aria-label={`Revenir à la version d’origine du modèle ${template.code}`}
                  onClick={() => simple(`Version d’origine — ${template.code}`, 'Le modèle compilé dans l’application reprendra effet.',
                    'La personnalisation est archivée, pas supprimée.', 'Revenir à l’origine', () => revertAdminMessage(template.code))}>
                  <Undo2 size={13} /> Origine
                </button>
              )}
            </div>
          </div>

          <dl className="admin-settings-grid">
            <div><dt>Objet envoyé</dt><dd>{(template.published ?? template.compiled).subject}</dd></div>
            <div><dt>Variables</dt><dd>{template.variables.join(', ') || 'Aucune'}</dd></div>
          </dl>
          {template.draft && (
            <p className="admin-journal-draft"><Eye size={13} aria-hidden="true" /> Brouillon non publié — objet : {template.draft.subject}</p>
          )}
        </section>
      ))}
    </>
  );
};

export default AdminMessagesPanel;
