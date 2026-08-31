import { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Send } from 'lucide-react';

import {
  getAdminContent,
  getAdminSettings,
  publishAdminContent,
  restoreAdminContentVersion,
  saveAdminContentDraft,
  saveAdminSettingGroup,
} from '../lib/api';
import { formatBusinessDateTime } from '../lib/business-time';
import './AdminSettingsPanel.css';

/**
 * Paramètres du Studio and Contenus (ADM-09).
 *
 * Settings apply on save; content goes through draft, preview and publish, so a text
 * change can be checked before the public sees it. Secrets are never editable here and
 * the interface says so, rather than leaving the owner to wonder where they are.
 */
const AdminSettingsPanel = ({ openActionDialog, runAction }) => {
  const [groups, setGroups] = useState([]);
  const [content, setContent] = useState([]);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((token) => token + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAdminSettings(), getAdminContent('fr')])
      .then(([settingGroups, contentEntries]) => {
        if (cancelled) return;
        setGroups(settingGroups);
        setContent(contentEntries);
        setError('');
      })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Impossible de charger les paramètres.'); });
    return () => { cancelled = true; };
  }, [reloadToken]);

  const editGroup = (group) => openActionDialog({
    title: `Paramètres — ${group.label}`,
    summary: group.description,
    consequence: 'Les valeurs enregistrées sont publiées immédiatement sur le site public.',
    confirmLabel: 'Enregistrer',
    fields: group.fields.map((field) => ({
      name: field.key,
      label: field.label + (field.help ? ` — ${field.help}` : ''),
      type: field.kind === 'multiline' ? 'textarea' : field.kind === 'number' ? 'number' : field.kind === 'boolean' ? 'select' : 'text',
      rows: 3,
      defaultValue: field.kind === 'boolean' ? String(group.values[field.key]) : String(group.values[field.key] ?? ''),
      ...(field.kind === 'boolean' ? { options: [{ value: 'true', label: 'Activé' }, { value: 'false', label: 'Désactivé' }] } : {}),
    })),
    onConfirm: async (values) => {
      const payload = Object.fromEntries(group.fields.map((field) => {
        const raw = values[field.key];
        if (field.kind === 'boolean') return [field.key, raw === 'true'];
        if (field.kind === 'number') return [field.key, Number(raw || 0)];
        return [field.key, String(raw ?? '').trim()];
      }));
      const success = await runAction(`Paramètres ${group.label}`, () => saveAdminSettingGroup(group.key, payload), true);
      if (success) reload();
    },
  });

  const editContent = (entry) => openActionDialog({
    title: `Contenu — ${entry.label}`,
    summary: entry.description,
    consequence: 'Enregistrer crée ou met à jour un brouillon. Le public ne voit rien avant la publication.',
    confirmLabel: 'Enregistrer le brouillon',
    fields: entry.fields.map((field) => ({
      name: field.key,
      label: field.label,
      type: field.kind === 'multiline' ? 'textarea' : 'text',
      rows: 3,
      defaultValue: String((entry.draft?.body ?? entry.effective)[field.key] ?? ''),
    })),
    onConfirm: async (values) => {
      const body = Object.fromEntries(entry.fields.map((field) => [field.key, String(values[field.key] ?? '')]));
      const success = await runAction(`Brouillon ${entry.label}`, () => saveAdminContentDraft(entry.key, 'fr', body), true);
      if (success) reload();
    },
  });

  const publish = (entry) => openActionDialog({
    title: `Publier — ${entry.label}`,
    summary: 'Le brouillon deviendra la version visible du public.',
    consequence: 'La version publiée actuelle est conservée dans l’historique, pas remplacée.',
    confirmLabel: 'Publier', fields: [],
    onConfirm: async () => {
      const success = await runAction(`Publication ${entry.label}`, () => publishAdminContent(entry.key, 'fr'), true);
      if (success) reload();
    },
  });


  const restore = (entry, version) => openActionDialog({
    title: `Restaurer la version ${version}`,
    summary: entry.label,
    consequence: 'Cette version devient un brouillon. Le site public ne change pas avant une publication explicite.',
    confirmLabel: 'Créer le brouillon', fields: [],
    onConfirm: async () => { const success = await runAction(`Restauration ${entry.label}`, () => restoreAdminContentVersion(entry.key, version), true); if (success) reload(); },
  });
  return (
    <>
      <div className="admin-page-header"><h1>Paramètres & <span>contenus</span></h1></div>
      {error && <div className="admin-feedback error" role="alert">{error}</div>}

      <section className="admin-card admin-settings-notice">
        <Lock size={18} aria-hidden="true" />
        <p>
          Les identifiants des fournisseurs — SMTP, Cal.com, WhatsApp — restent dans la configuration du serveur et ne
          sont jamais modifiables ici. Cette page contient les informations publiques et les activations.
        </p>
      </section>

      {groups.map((group) => (
        <section className="admin-card" key={group.key} aria-labelledby={`group-${group.key}`}>
          <div className="admin-agenda-head">
            <h2 id={`group-${group.key}`}>{group.label}</h2>
            <button type="button" className="btn btn-secondary admin-sm-btn"
              aria-label={`Modifier les paramètres ${group.label}`} onClick={() => editGroup(group)}>Modifier</button>
          </div>
          <p className="admin-record-hint">{group.description}</p>
          <dl className="admin-settings-grid">
            {group.fields.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{typeof group.values[field.key] === 'boolean'
                  ? (group.values[field.key] ? 'Activé' : 'Désactivé')
                  : (String(group.values[field.key] ?? '').trim() || 'Non renseigné')}</dd>
              </div>
            ))}
          </dl>
          <p className="admin-settings-origin">
            {group.isCustomised
              ? `Personnalisé${group.updatedAt ? ` le ${formatBusinessDateTime(group.updatedAt)}` : ''}${group.updatedBy ? ` par ${group.updatedBy.name}` : ''}.`
              : 'Valeurs par défaut de l’application. Aucune personnalisation enregistrée.'}
          </p>
        </section>
      ))}

      <div className="admin-page-header"><h1>Contenus <span>éditoriaux</span></h1></div>
      {content.map((entry) => (
        <section className="admin-card" key={entry.key} aria-labelledby={`content-${entry.key}`}>
          <div className="admin-agenda-head">
            <h2 id={`content-${entry.key}`}>{entry.label}</h2>
            <div className="admin-action-row">
              <button type="button" className="btn btn-secondary admin-sm-btn"
                aria-label={`Modifier le contenu ${entry.label}`} onClick={() => editContent(entry)}>Modifier</button>
              <button type="button" className="btn btn-primary admin-sm-btn" disabled={!entry.draft}
                aria-label={`Publier le contenu ${entry.label}`}
                title={entry.draft ? undefined : 'Aucun brouillon à publier.'}
                onClick={() => publish(entry)}><Send size={14} /> Publier</button>
            </div>
          </div>
          <p className="admin-record-hint">{entry.description}</p>

          <h3 className="admin-settings-subhead">Version visible du public</h3>
          <dl className="admin-settings-grid">
            {entry.fields.map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>{String(entry.effective[field.key] ?? '').trim() || 'Non renseigné'}</dd>
              </div>
            ))}
          </dl>

          {entry.draft && (
            <>
              <h3 className="admin-settings-subhead admin-settings-subhead--draft">
                Brouillon non publié — version {entry.draft.version}
              </h3>
              <dl className="admin-settings-grid admin-settings-grid--draft">
                {entry.fields.map((field) => (
                  <div key={field.key}>
                    <dt>{field.label}</dt>
                    <dd>{String(entry.draft.body[field.key] ?? '').trim() || 'Non renseigné'}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {entry.history.length > 0 && (
            <div className="admin-settings-origin">
              <CheckCircle2 size={13} aria-hidden="true" /> {entry.history.length} version(s) enregistrée(s).
              {entry.published ? ` Publiée le ${formatBusinessDateTime(entry.published.publishedAt)}.` : ' Aucune publication.'}
              <div className="admin-action-row">{entry.history.filter((version) => version.status === 'ARCHIVED').map((version) => <button key={version.id} type="button" className="btn btn-secondary admin-sm-btn" onClick={() => restore(entry, version.version)}>Restaurer v{version.version}</button>)}</div>
            </div>
          )}
        </section>
      ))}
    </>
  );
};

export default AdminSettingsPanel;
