import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, RotateCcw, Search, Send, Undo2 } from 'lucide-react';

import {
  previewAdminMessage,
  publishAdminMessage,
  revertAdminMessage,
  saveAdminMessageDraft,
  saveAdminMessageRule,
  searchAdminNotifications,
  testSendAdminMessage,
} from '../lib/api';
import { formatBusinessDateTime } from '../lib/business-time';
import { NOTIFICATION_AUDIENCE_LABELS, notificationTypeDescriptor, statusLabel } from '../lib/status-labels';
import './AdminMessagesPanel.css';

const STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'];
const resolutionLabel = (code) => statusLabel(code || 'UNCLASSIFIED');
const filtersFromParams = (params) => ({
  channel: params.get('channel') || '', status: params.getAll('status'), type: params.get('type') || '',
  from: params.get('from') || '', to: params.get('to') || '', actionableOnly: params.get('actionableOnly') === 'true',
  includeDisabledChannels: params.get('includeDisabledChannels') === 'true',
});

const AdminMessagesPanel = ({ refreshToken, templates, templatesMeta, rules = [], onReloadTemplates, openActionDialog, runAction, onResolve, onRetry, busyActions }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const queryKey = searchParams.toString();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, hiddenChannels: [] });
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [templateLocale, setTemplateLocale] = useState('fr');

  useEffect(() => {
    let cancelled = false;
    searchAdminNotifications({ ...filtersFromParams(new URLSearchParams(queryKey)), limit: 50 })
      .then((result) => { if (!cancelled) { setItems(result.items); setMeta(result.meta); setError(''); } })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Impossible de charger le journal.'); });
    return () => { cancelled = true; };
  }, [queryKey, refreshToken]);

  useEffect(() => { void onReloadTemplates(templateLocale); }, [templateLocale, refreshToken]);

  const apply = (next) => {
    const params = new URLSearchParams();
    if (next.channel) params.set('channel', next.channel);
    next.status.forEach((status) => params.append('status', status));
    if (next.type) params.set('type', next.type);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    if (next.actionableOnly) params.set('actionableOnly', 'true');
    if (next.includeDisabledChannels) params.set('includeDisabledChannels', 'true');
    setSearchParams(params);
  };

  const reloadLibrary = () => onReloadTemplates(templateLocale);
  const editTemplate = (template) => {
    const source = template.draft ?? template.published ?? template.compiled;
    const delivery = source.delivery ?? {};
    openActionDialog({
      title: `Modèle ${template.code} — ${templateLocale === 'en' ? 'English' : 'Français'}`,
      summary: `${template.audience === 'admin' ? 'Message interne' : 'Message client'} · variables : ${template.variables.join(', ') || 'aucune'}`,
      consequence: 'Enregistrer crée un brouillon. Le contenu et les entêtes ne changent qu’après publication.',
      confirmLabel: 'Enregistrer le brouillon',
      fields: [
        { name: 'subject', label: 'Objet', required: true, defaultValue: source.subject },
        { name: 'preheader', label: 'Aperçu court', defaultValue: source.preheader },
        { name: 'body', label: 'Contenu, une ligne par paragraphe', type: 'textarea', rows: 10, required: true, defaultValue: (source.body || []).join('\n') },
        { name: 'senderName', label: 'Nom de l’expéditeur (facultatif)', defaultValue: delivery.senderName ?? '' },
        { name: 'fromAddress', label: 'Adresse expéditrice (facultative)', type: 'email', defaultValue: delivery.fromAddress ?? '', help: 'Doit être autorisée par votre fournisseur SMTP.' },
        { name: 'replyTo', label: 'Adresse de réponse (facultative)', type: 'email', defaultValue: delivery.replyTo ?? '' },
        { name: 'fallbackChannel', label: 'Canal de secours après échec définitif', type: 'select', defaultValue: delivery.fallbackChannel ?? '', options: [{ value: '', label: 'Aucun' }, { value: 'whatsapp', label: 'WhatsApp si configuré' }] },
      ],
      preview: async (values) => {
        const result = await previewAdminMessage(template.code, {
          locale: templateLocale, subject: values.subject, preheader: values.preheader,
          body: String(values.body || '').split('\n'), senderName: values.senderName, fromAddress: values.fromAddress,
          replyTo: values.replyTo, fallbackChannel: values.fallbackChannel || null,
        });
        return { locale: result.locale, subject: result.subject, preheader: result.preheader, text: result.text };
      },
      onConfirm: async (values) => {
        const success = await runAction(`Brouillon ${template.code}`, () => saveAdminMessageDraft(template.code, {
          locale: templateLocale, subject: values.subject.trim(), preheader: values.preheader.trim(),
          body: String(values.body || '').split('\n').filter((line) => line.trim()), senderName: values.senderName.trim(),
          fromAddress: values.fromAddress.trim(), replyTo: values.replyTo.trim(), fallbackChannel: values.fallbackChannel || null,
        }), true);
        if (success) await reloadLibrary();
      },
    });
  };

  const editRule = (rule) => {
    const descriptor = notificationTypeDescriptor(rule.event);
    openActionDialog({
      title: `Règle d’envoi — ${descriptor.name}`,
      summary: descriptor.trigger || 'Message interne au studio.',
      consequence: rule.canBeDisabled ? 'La règle vise les messages encore en attente.' : 'Cette alerte ne peut pas être désactivée.',
      confirmLabel: 'Enregistrer la règle',
      fields: [
        { name: 'delayMinutes', label: 'Délai avant envoi, en minutes', type: 'number', min: 0, max: 10080, wide: false, defaultValue: rule.delayMinutes ?? '', help: 'Vide : envoi immédiat.' },
        { name: 'groupingWindowMinutes', label: 'Regroupement, en minutes', type: 'number', min: 0, max: 1440, wide: false, defaultValue: rule.groupingWindowMinutes ?? '', help: 'Vide : aucun regroupement.' },
        { name: 'maxAttempts', label: 'Tentatives maximum', type: 'number', min: 1, max: 20, wide: false, defaultValue: rule.maxAttempts ?? '', help: 'Vide : valeur de l’application.' },
        { name: 'fallbackChannel', label: 'Canal de secours', type: 'select', wide: false, defaultValue: rule.fallbackChannel ?? '', options: [{ value: '', label: 'Aucun' }, { value: 'whatsapp', label: 'WhatsApp si configuré' }] },
        ...(rule.canBeDisabled ? [{ name: 'isEnabled', label: 'Envoyer ce message', type: 'select', wide: false, defaultValue: rule.isEnabled ? 'true' : 'false', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] }] : []),
      ],
      onConfirm: async (values) => {
        const number = (value) => (String(value ?? '').trim() === '' ? null : Number(value));
        const success = await runAction(`Règle ${rule.event}`, () => saveAdminMessageRule({
          event: rule.event, delayMinutes: number(values.delayMinutes), groupingWindowMinutes: number(values.groupingWindowMinutes),
          maxAttempts: number(values.maxAttempts), fallbackChannel: values.fallbackChannel || null,
          isEnabled: rule.canBeDisabled ? values.isEnabled !== 'false' : true,
        }), true);
        if (success) await reloadLibrary();
      },
    });
  };

  const confirm = (title, summary, consequence, label, action) => openActionDialog({
    title, summary, consequence, confirmLabel: label, fields: [],
    onConfirm: async () => { const ok = await runAction(label, action, true); if (ok) await reloadLibrary(); },
  });

  return <>
    <div className="admin-page-header"><h1>Messages & <span>journal</span></h1></div>
    {error && <div className="admin-feedback error" role="alert">{error}</div>}
    <form className="admin-card admin-finance-filters" key={queryKey} onSubmit={(event) => {
      event.preventDefault(); const values = new FormData(event.currentTarget);
      apply({ channel: String(values.get('channel') || ''), status: values.getAll('status').map(String), type: String(values.get('type') || '').trim(), from: String(values.get('from') || ''), to: String(values.get('to') || ''), actionableOnly: values.get('actionableOnly') === 'true', includeDisabledChannels: values.get('includeDisabledChannels') === 'true' });
    }}>
      <div><label htmlFor="journal-channel">Canal</label><select id="journal-channel" name="channel" className="form-input" defaultValue={filters.channel}><option value="">Tous les canaux actifs</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option></select></div>
      <div><label htmlFor="journal-type">Type de message</label><input id="journal-type" name="type" className="form-input" defaultValue={filters.type} /></div>
      <div><label htmlFor="journal-from">Du</label><input id="journal-from" name="from" type="date" className="form-input" defaultValue={filters.from} /></div>
      <div><label htmlFor="journal-to">au</label><input id="journal-to" name="to" type="date" className="form-input" defaultValue={filters.to} /></div>
      <fieldset className="admin-filter-group"><legend>Statut</legend>{STATUSES.map((status) => <label key={status} className="admin-filter-chip"><input type="checkbox" name="status" value={status} defaultChecked={filters.status.includes(status)} /><span>{statusLabel(status)}</span></label>)}</fieldset>
      <label className="admin-finance-overdue"><input name="actionableOnly" type="checkbox" value="true" defaultChecked={filters.actionableOnly} /> Anomalies exploitables uniquement</label>
      <label className="admin-finance-overdue"><input name="includeDisabledChannels" type="checkbox" value="true" defaultChecked={filters.includeDisabledChannels} /> Inclure les canaux désactivés</label>
      <button type="submit" className="btn btn-primary"><Search size={15} /> Filtrer</button>
    </form>
    <div className="admin-card"><div className="admin-finance-summary"><strong>{meta.total} message(s)</strong>{meta.hiddenChannels?.length > 0 && <span className="admin-journal-hidden">Canal masqué : {meta.hiddenChannels.join(', ')}</span>}</div>
      {items.length === 0 ? <p className="admin-table-empty">Aucun message ne correspond à ces filtres.</p> : <ul className="admin-journal">{items.map((item) => {
        const descriptor = notificationTypeDescriptor(item.type); const open = Boolean(expanded[item.id]);
        return <li key={item.id} className="admin-journal-row"><div className="admin-journal-head"><div><strong>{descriptor.name}</strong>{descriptor.audience && <span className={`admin-pill admin-pill--audience audience-${descriptor.audience.toLowerCase()}`}>{NOTIFICATION_AUDIENCE_LABELS[descriptor.audience]}</span>}<span className={`admin-pill pill-${String(item.status).toLowerCase()}`}>{statusLabel(item.status)}</span></div><small>{item.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'} · {item.recipient} · {formatBusinessDateTime(item.createdAt)}</small>{item.resolution && <small className="admin-journal-resolution">Disposition : {resolutionLabel(item.resolution)}</small>}</div><div className="admin-journal-actions">{item.status === 'FAILED' && !item.resolution && <><button type="button" className="btn btn-secondary admin-sm-btn" disabled={Boolean(busyActions?.['notifications:Classification notification'])} onClick={() => onResolve(item, 'OBSOLETE')}>Classer obsolète</button><button type="button" className="btn btn-secondary admin-sm-btn" disabled={Boolean(busyActions?.['notifications:Classification notification'])} onClick={() => onResolve(item, 'ACTIONABLE_REVIEW_REQUIRED')}>À examiner</button></>}{item.resolution === 'ACTIONABLE_REVIEW_REQUIRED' && <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => onRetry(item)}><RotateCcw size={13} /> Réessayer</button>}<button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))}>{open ? 'Masquer le détail' : 'Détail technique'}</button></div>{open && <dl className="admin-journal-technical"><div><dt>Code technique</dt><dd><code>{item.type}</code></dd></div><div><dt>Modèle</dt><dd>{item.templateCode || '—'}{item.templateVersion ? ` · v${item.templateVersion}` : ''}</dd></div><div><dt>Tentatives</dt><dd>{item.attemptCount}/{item.maxAttempts}</dd></div><div><dt>Statut fournisseur</dt><dd>{item.providerStatus || '—'}</dd></div><div><dt>Erreur</dt><dd>{item.error || 'Aucune'}</dd></div></dl>}</li>;
      })}</ul>}</div>

    <div className="admin-page-header"><h1>Bibliothèque de <span>messages</span></h1></div>
    <div className="admin-action-row" role="group" aria-label="Langue des modèles"><button type="button" className="btn btn-secondary admin-sm-btn" disabled={templateLocale === 'fr'} onClick={() => setTemplateLocale('fr')}>Français</button><button type="button" className="btn btn-secondary admin-sm-btn" disabled={templateLocale === 'en'} onClick={() => setTemplateLocale('en')}>English</button></div>
    <p className="admin-record-hint admin-library-note">Modèles {templateLocale === 'en' ? 'anglais' : 'français'} : brouillon, aperçu, publication et test sont séparés par langue. {templatesMeta?.overrides ? `${templatesMeta.overrides.count} modèle(s) publié(s) personnalisé(s).` : ''}</p>
    {templates.map((template) => <section className="admin-card" key={template.code}><div className="admin-agenda-head"><h2>{template.code}<span className={`admin-pill admin-pill--audience audience-${template.audience === 'admin' ? 'internal' : 'client'}`}>{template.audience === 'admin' ? 'Interne' : 'Client'}</span>{template.isOverridden && <span className="admin-pill admin-pill--count">Personnalisé</span>}</h2><div className="admin-action-row"><button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => editTemplate(template)}>Modifier</button><button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => confirm(`Envoi de test — ${template.code}`, 'Le message part vers l’adresse du studio.', 'Aucun client ne reçoit cet envoi.', 'Envoyer le test', () => testSendAdminMessage(template.code, templateLocale))}><Send size={13} /> Test</button><button type="button" className="btn btn-primary admin-sm-btn" disabled={!template.draft} onClick={() => confirm(`Publier — ${template.code}`, 'Le brouillon remplacera le texte envoyé.', 'La version précédente est conservée.', 'Publier', () => publishAdminMessage(template.code, templateLocale))}>Publier</button>{template.isOverridden && <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => confirm(`Version d’origine — ${template.code}`, 'Le modèle compilé reprendra effet.', 'La personnalisation sera archivée.', 'Revenir à l’origine', () => revertAdminMessage(template.code, templateLocale))}><Undo2 size={13} /> Origine</button>}</div></div><dl className="admin-settings-grid"><div><dt>Objet envoyé</dt><dd>{(template.published ?? template.compiled).subject}</dd></div><div><dt>Variables</dt><dd>{template.variables.join(', ') || 'Aucune'}</dd></div><div><dt>Canal</dt><dd>E-mail{(template.published ?? template.compiled).delivery?.replyTo ? ` · réponse : ${(template.published ?? template.compiled).delivery.replyTo}` : ''}</dd></div></dl>{template.draft && <p className="admin-journal-draft"><Eye size={13} /> Brouillon non publié — objet : {template.draft.subject}</p>}</section>)}

    <div className="admin-page-header"><h1>Règles <span>d’envoi</span></h1></div>
    <p className="admin-record-hint admin-library-note">Ces règles concernent les alertes internes. Un canal de secours n’est tenté qu’après échec définitif et seulement si WhatsApp et le destinataire sont configurés.</p>
    <ul className="admin-rule-list">{rules.map((rule) => { const descriptor = notificationTypeDescriptor(rule.event); return <li key={rule.event} className="admin-card admin-rule"><div className="admin-rule__head"><div><h2>{descriptor.name}</h2>{descriptor.trigger && <small>{descriptor.trigger}</small>}</div><div className="admin-action-row">{!rule.isEnabled && <span className="admin-pill admin-pill--count">Désactivé</span>}<button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => editRule(rule)}>Modifier</button></div></div><dl className="admin-settings-grid"><div><dt>Délai</dt><dd>{rule.delayMinutes ? `${rule.delayMinutes} min` : 'Immédiat'}</dd></div><div><dt>Regroupement</dt><dd>{rule.groupingWindowMinutes ? `${rule.groupingWindowMinutes} min` : 'Aucun'}</dd></div><div><dt>Tentatives</dt><dd>{rule.maxAttempts ?? '5 (application)'}</dd></div><div><dt>Secours</dt><dd>{rule.fallbackChannel === 'whatsapp' ? 'WhatsApp si configuré' : 'Aucun'}</dd></div></dl></li>; })}</ul>
  </>;
};

export default AdminMessagesPanel;
