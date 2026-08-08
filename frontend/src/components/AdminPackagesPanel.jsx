import React, { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

import {
  archiveAdminPackage,
  createAdminPackage,
  deleteAdminPackage,
  duplicateAdminPackage,
  publishAdminPackage,
  updateAdminPackage,
  validateAdminPackage,
} from '../lib/api';
import { packageReferenceCount, statusLabel } from '../lib/admin-workflow';
import { formatFcfa } from '../lib/display-formatters';
import {
  businessDateTimeLocalValue,
  doualaLocalDateTimeToIso,
  formatBusinessDateTime,
} from '../lib/business-time';
import AdminActionDialog from './AdminActionDialog';

const pill = (status) => (
  <span className={`admin-pill pill-${String(status).toLowerCase()}`}>{statusLabel(status)}</span>
);

const AdminPackagesPanel = ({ packs, adminUser, onRefresh, onFeedback }) => {
  const [editingPack, setEditingPack] = useState(null);
  const [previewPack, setPreviewPack] = useState(null);
  const [actionDialog, setActionDialog] = useState(null);

  const closeDialog = () => setActionDialog(null);
  const runAction = async (label, action) => {
    try {
      await action();
      await onRefresh();
      onFeedback({ tab: 'tarifs', type: 'success', message: label + ' enregistrée.' });
    } catch (error) {
      onFeedback({ tab: 'tarifs', type: 'error', message: error?.message || label + ' impossible.' });
      throw error;
    }
  };
  const simpleAction = (config, label, action) => setActionDialog({
    fields: [],
    confirmLabel: label,
    ...config,
    onConfirm: () => runAction(label, action),
  });

  const inclusionsText = (pack) => Array.isArray(pack?.inclusions) ? pack.inclusions.join('\n') : '';
  const fields = (pack = {}) => [
    { name: 'name', label: 'Nom', required: true, defaultValue: pack.name || '' },
    { name: 'slug', label: 'Identifiant URL', required: true, defaultValue: pack.slug || '', validate: (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value)) ? '' : 'Utilisez uniquement minuscules, chiffres et tirets.' },
    { name: 'category', label: 'Catégorie', required: true, defaultValue: pack.category || '' },
    { name: 'price', label: 'Montant', type: 'number', required: true, defaultValue: String(pack.price ?? 0), min: '0', validate: (value) => Number(value) >= 0 ? '' : 'Le montant doit être positif ou nul.' },
    { name: 'currency', label: 'Devise', type: 'select', required: true, defaultValue: pack.currency || 'XAF', options: [{ value: 'XAF', label: 'XAF — franc CFA' }] },
    { name: 'durationMin', label: 'Durée en minutes', type: 'number', required: true, defaultValue: String(pack.durationMin ?? 60), min: '15', validate: (value) => Number(value) >= 15 ? '' : 'La durée minimale est de 15 minutes.' },
    { name: 'description', label: 'Résumé public', type: 'textarea', defaultValue: pack.description || '' },
    { name: 'content', label: 'Contenu de la formule', type: 'textarea', required: true, defaultValue: pack.content || '' },
    { name: 'inclusions', label: 'Inclusions — une par ligne', type: 'textarea', required: true, defaultValue: inclusionsText(pack), validate: (value) => String(value).split('\n').some((line) => line.trim()) ? '' : 'Renseignez au moins une inclusion.' },
    { name: 'conditions', label: 'Conditions applicables', type: 'textarea', required: true, defaultValue: pack.conditions || '' },
    { name: 'legalText', label: 'Mentions obligatoires', type: 'textarea', required: true, defaultValue: pack.legalText || '' },
    { name: 'effectiveAt', label: 'Date d’effet à Douala', type: 'datetime-local', required: true, defaultValue: pack.effectiveAt ? businessDateTimeLocalValue(pack.effectiveAt) : businessDateTimeLocalValue(new Date()) },
    { name: 'deliveryLabel', label: 'Délai de livraison', defaultValue: pack.deliveryLabel || '' },
    { name: 'sortOrder', label: 'Ordre d’affichage', type: 'number', required: true, defaultValue: String(pack.sortOrder ?? 0), min: '0' },
  ];
  const draftPayload = (values) => {
    let effectiveAt;
    try { effectiveAt = doualaLocalDateTimeToIso(values.effectiveAt); }
    catch { throw new Error('La date d’effet est invalide.'); }
    return {
      name: values.name.trim(),
      slug: values.slug.trim(),
      category: values.category.trim(),
      price: Number(values.price),
      currency: values.currency,
      durationMin: Number(values.durationMin),
      description: values.description.trim() || null,
      content: values.content.trim(),
      inclusions: values.inclusions.split('\n').map((line) => line.trim()).filter(Boolean),
      conditions: values.conditions.trim(),
      legalText: values.legalText.trim(),
      effectiveAt,
      deliveryLabel: values.deliveryLabel.trim() || null,
      sortOrder: Number(values.sortOrder),
    };
  };

  const createItem = () => setActionDialog({
    title: 'Créer un brouillon tarifaire',
    summary: 'Catalogue public',
    consequence: 'La formule restera invisible au public jusqu’à validation de ses mentions puis publication.',
    confirmLabel: 'Créer le brouillon',
    fields: fields(),
    onConfirm: (values) => runAction('Création du brouillon', () => createAdminPackage(draftPayload(values))),
  });
  const editItem = (pack) => setActionDialog({
    title: 'Modifier le brouillon',
    summary: pack.name + ' · version ' + pack.version,
    consequence: 'La version publiée reste inchangée. Toute modification remet cette version au statut brouillon.',
    confirmLabel: 'Enregistrer le brouillon',
    fields: fields(pack),
    onConfirm: async (values) => {
      setEditingPack(pack.id);
      try { await runAction('Modification du brouillon', () => updateAdminPackage(pack.id, draftPayload(values))); }
      finally { setEditingPack(null); }
    },
  });
  const duplicateItem = (pack) => simpleAction({
    title: 'Dupliquer la formule',
    summary: pack.name,
    consequence: 'Une copie en brouillon sera créée; les mentions devront être validées de nouveau.',
  }, 'Dupliquer', () => duplicateAdminPackage(pack.id));
  const validateItem = (pack) => simpleAction({
    title: 'Valider les mentions',
    summary: pack.name + ' · version ' + pack.version,
    consequence: 'Vous confirmez que le contenu, les conditions et les mentions obligatoires ont été vérifiés.',
  }, 'Valider les mentions', () => validateAdminPackage(pack.id, { expectedVersion: pack.version, mentionsApproved: true }));
  const publishItem = (pack) => simpleAction({
    title: 'Publier la formule',
    summary: pack.name + ' · version ' + pack.version,
    consequence: 'Cette version remplacera la version publique précédente à son prix, son contenu et ses conditions actuels.',
  }, 'Publier la formule', () => publishAdminPackage(pack.id, { expectedVersion: pack.version }));
  const archiveItem = (pack) => simpleAction({
    title: 'Archiver la formule',
    summary: pack.name + ' · version publiée ' + pack.publishedVersion,
    consequence: 'La formule disparaîtra du catalogue; les réservations historiques restent intactes.',
    destructive: true,
  }, 'Archiver la formule', () => archiveAdminPackage(pack.id, { expectedVersion: pack.publishedVersion }));
  const moveItem = (pack, direction) => simpleAction({
    title: 'Modifier l’ordre',
    summary: pack.name,
    consequence: 'Seul l’ordre du catalogue changera; aucune version tarifaire ne sera créée.',
  }, 'Modifier l’ordre', () => updateAdminPackage(pack.id, { sortOrder: Math.max(0, pack.sortOrder + direction) }));
  const removeItem = (pack) => {
    const references = packageReferenceCount(pack);
    if (references > 0) {
      onFeedback({ tab: 'tarifs', type: 'error', message: 'Suppression interdite : ' + references + ' référence(s). Archivez la formule.' });
      return;
    }
    simpleAction({
      title: 'Supprimer définitivement la formule',
      summary: pack.name,
      consequence: 'Suppression irréversible réservée aux formules sans réservation ni intention.',
      destructive: true,
    }, 'Supprimer la formule', () => deleteAdminPackage(pack.id));
  };

  return (
    <>
      <div className="admin-page-header">
        <h1>Édition des <span>Tarifs</span></h1>
        <button className="btn btn-primary admin-sm-btn" onClick={createItem}>Créer un brouillon</button>
      </div>
      <div className="admin-card">
        {packs.map((pack) => (
          <div key={pack.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', padding: '1.5rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div>
              <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{pack.name}</strong>
              <small style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginTop: '0.25rem' }}>{pack.category}</small>
              <small style={{ color: 'rgba(255,255,255,0.55)', display: 'block', marginTop: '0.35rem' }}>{formatFcfa(pack.price)} · {pack.durationMin} min · version {pack.version} · ordre {pack.sortOrder}</small>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>{pill(pack.publicationStatus || (pack.isArchived ? 'ARCHIVED' : 'DRAFT'))} {pill(`${packageReferenceCount(pack)} référence(s)`)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => setPreviewPack(pack)}>Aperçu avant publication</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => editItem(pack)} disabled={editingPack === pack.id}>{editingPack === pack.id ? 'Modification...' : 'Modifier le brouillon'}</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => duplicateItem(pack)}>Dupliquer</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => moveItem(pack, -1)} aria-label={`Monter ${pack.name}`}>↑</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => moveItem(pack, 1)} aria-label={`Descendre ${pack.name}`}>↓</button>
              {pack.publicationStatus === 'DRAFT' && <button className="btn btn-secondary admin-sm-btn" onClick={() => validateItem(pack)} disabled={adminUser?.role !== 'OWNER'}>Valider les mentions</button>}
              {pack.publicationStatus === 'VALIDATED' && <button className="btn btn-primary admin-sm-btn" onClick={() => publishItem(pack)} disabled={adminUser?.role !== 'OWNER'}>Publier la formule</button>}
              {pack.publishedVersion && !pack.isArchived && <button className="btn btn-secondary admin-sm-btn" onClick={() => archiveItem(pack)} disabled={adminUser?.role !== 'OWNER'}>Archiver</button>}
              <button className="btn btn-secondary admin-sm-btn text-danger" onClick={() => removeItem(pack)} disabled={packageReferenceCount(pack) > 0}><Trash2 size={12} /> Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {previewPack && (
          <div className="admin-modal-backdrop" onClick={() => setPreviewPack(null)}>
            <Motion.div className="admin-modal-content" role="dialog" aria-modal="true" aria-labelledby="package-preview-title" onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <button onClick={() => setPreviewPack(null)} className="admin-modal-close" type="button" aria-label="Fermer la fenêtre">&times;</button>
              <h2 id="package-preview-title">Aperçu avant publication — <span>{previewPack.name}</span></h2>
              <p>{previewPack.description || 'Aucun résumé public.'}</p>
              <div className="admin-modal-info-row"><span>Montant :</span><strong>{formatFcfa(previewPack.price)}</strong></div>
              <div className="admin-modal-info-row"><span>Durée :</span><strong>{previewPack.durationMin} minutes</strong></div>
              <div className="admin-modal-info-row"><span>Date d’effet :</span><strong>{previewPack.effectiveAt ? formatBusinessDateTime(previewPack.effectiveAt) : 'Non renseignée'}</strong></div>
              <div className="admin-modal-info-row"><span>Statut :</span><strong>{pill(previewPack.publicationStatus || 'DRAFT')}</strong></div>
              <div className="admin-modal-block"><strong>Contenu de la formule</strong><p>{previewPack.content || 'Non renseigné'}</p></div>
              <div className="admin-modal-block"><strong>Inclusions</strong><ul>{(Array.isArray(previewPack.inclusions) ? previewPack.inclusions : []).map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="admin-modal-block"><strong>Conditions applicables</strong><p>{previewPack.conditions || 'Non renseignées'}</p></div>
              <div className="admin-modal-block"><strong>Mentions obligatoires</strong><p>{previewPack.legalText || 'Non renseignées'}</p></div>
              {previewPack.publishedAt && <div className="admin-modal-info-row"><span>Publication :</span><strong>{formatBusinessDateTime(previewPack.publishedAt)} · {previewPack.publishedBy?.name || 'Auteur historique'}</strong></div>}
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
      {actionDialog && <AdminActionDialog config={actionDialog} onClose={closeDialog} />}
    </>
  );
};

export default AdminPackagesPanel;
