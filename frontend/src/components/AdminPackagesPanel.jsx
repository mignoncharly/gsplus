import React, { useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

import {
  archiveAdminPackage,
  createAdminPackage,
  deleteAdminPackage,
  duplicateAdminPackage,
  publishAdminPackage,
  reorderAdminPackages,
  updateAdminPackage,
  validateAdminPackage,
} from '../lib/api';
import { packageReferenceCount, statusLabel } from '../lib/admin-workflow';
import { formatFcfa } from '../lib/display-formatters';
import { GENERIC_DELIVERY_CONTACT, GENERIC_DELIVERY_CONTACT_ENGLISH, slugify } from '../lib/packages';
import {
  businessDateTimeLocalValue,
  doualaLocalDateTimeToIso,
  formatBusinessDateTime,
} from '../lib/business-time';
import AdminActionDialog from './AdminActionDialog';

const pill = (status) => (
  <span className={`admin-pill pill-${String(status).toLowerCase()}`}>{statusLabel(status)}</span>
);

// A reference count is a measurement, not a publication status. Routing it through
// statusLabel() made every offer read "PUBLIÉ · STATUT NON RECONNU" (ADM-07).
// French takes the singular below two, so 0 is "0 référence", not "0 références".
const countChip = (count) => (
  <span className="admin-pill admin-pill--count">{count} référence{count < 2 ? '' : 's'}</span>
);

const AdminPackagesPanel = ({ packs, taxonomy = [], adminUser, onRefresh, onFeedback }) => {
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
  /**
   * The controlled list of the eight public sections, read from the taxonomy itself.
   *
   * It used to be derived from the formulas that already existed, so a section with no
   * formula in it could not be chosen — which is precisely the case an owner opening a
   * new section is in. Inactive sections are left out: they are not shown to the public,
   * so a formula must not be filed under one.
   */
  const taxonomyOptions = taxonomy
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.key,
      label: item.locales?.find((entry) => entry.locale === 'fr')?.label || item.key,
    }));
  const localized = (pack, locale) => pack?.currentVersion?.locales?.find((item) => item.locale === locale) || pack?.locales?.find((item) => item.locale === locale);
  const advanced = (values) => values.advanced === 'true';
  const isDirect = (values) => values.bookingMode === 'DIRECT';
  const wantsEnglish = (values) => values.englishEnabled === 'true';

  const fields = (pack = {}) => {
    const existing = Boolean(pack.id);
    const optionsOf = (item) => (item?.options && typeof item.options === 'object' && !Array.isArray(item.options) ? item.options : {});
    const packOptions = optionsOf(pack);
    const initialPriceKind = pack.isRange ? 'FROM' : (packOptions.priceSuffix ? 'PER_MONTH' : 'FIXED');
    const initialDelivery = !pack.deliveryLabel || pack.deliveryLabel === GENERIC_DELIVERY_CONTACT ? 'CONTACT' : 'LEAD_TIME';
    return [
      { name: 'name', label: 'Nom', required: true, defaultValue: pack.name || '' },
      // The slug follows the name until someone edits it, and an existing formula never
      // has its URL rewritten behind the owner's back — a published link would break.
      { name: 'slug', label: 'Identifiant URL', required: true, defaultValue: pack.slug || '',
        visibleWhen: advanced, wide: false,
        ...(existing ? {} : { deriveFrom: 'name', derive: (value) => slugify(value) }),
        help: existing ? 'Modifier l’identifiant change l’adresse publique de la formule.' : 'Généré à partir du nom tant que vous n’y touchez pas.',
        validate: (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value)) ? '' : 'Utilisez uniquement minuscules, chiffres et tirets.' },
      { name: 'taxonomyKey', label: 'Section publique', type: 'select', required: true,
        defaultValue: pack.taxonomyKey || taxonomyOptions[0]?.value || '', options: taxonomyOptions,
        help: 'Les sections se gèrent dans Paramètres ; elles ne se créent pas depuis une formule.' },

      { name: 'bookingMode', label: 'Mode de réservation', type: 'select', required: true, wide: false,
        defaultValue: pack.bookingMode || 'DIRECT',
        options: [{ value: 'DIRECT', label: 'Réservation directe' }, { value: 'CONTACT', label: 'Prise de contact' }],
        help: 'Détermine la durée, la livraison et le bouton affiché au public.' },
      { name: 'durationMin', label: 'Durée en minutes', type: 'number', min: '15', wide: false,
        visibleWhen: isDirect, required: isDirect,
        defaultValue: pack.durationMin === null || pack.durationMin === undefined ? '' : String(pack.durationMin),
        requiredMessage: 'La durée est obligatoire pour une réservation directe.',
        validate: (value) => value === '' || Number(value) >= 15 ? '' : 'La durée minimale est de 15 minutes.' },

      { name: 'priceKind', label: 'Forme du tarif', type: 'select', required: true, wide: false,
        defaultValue: initialPriceKind,
        options: [
          { value: 'FIXED', label: 'Montant fixe' },
          { value: 'FROM', label: 'À partir de' },
          { value: 'PER_MONTH', label: 'Par mois — abonnement' },
        ],
        help: 'Les pourcentages et les doubles avantages se gèrent dans les Privilèges Golden.' },
      { name: 'price', label: 'Montant', type: 'number', required: true, min: '0', wide: false,
        defaultValue: String(pack.price ?? 0),
        validate: (value) => Number(value) >= 0 ? '' : 'Le montant doit être positif ou nul.' },
      { name: 'currency', label: 'Devise', type: 'select', required: true, wide: false,
        defaultValue: pack.currency || 'XAF', options: [{ value: 'XAF', label: 'XAF — franc CFA' }],
        help: 'Le studio facture en francs CFA uniquement.' },
      { name: 'commitmentMonths', label: 'Engagement en mois', type: 'number', min: '1', wide: false,
        visibleWhen: (values) => values.priceKind === 'PER_MONTH', required: (values) => values.priceKind === 'PER_MONTH',
        defaultValue: packOptions.subscription?.commitmentMonths ? String(packOptions.subscription.commitmentMonths) : '' },
      { name: 'sessionsPerMonth', label: 'Séances par mois', type: 'number', min: '1', wide: false,
        visibleWhen: (values) => values.priceKind === 'PER_MONTH', required: (values) => values.priceKind === 'PER_MONTH',
        defaultValue: packOptions.subscription?.sessionsPerMonth ? String(packOptions.subscription.sessionsPerMonth) : '' },

      { name: 'deliveryKind', label: 'Livraison', type: 'select', required: true, wide: false,
        defaultValue: initialDelivery,
        options: [{ value: 'LEAD_TIME', label: 'Délai annoncé' }, { value: 'CONTACT', label: 'Nous contacter' }] },
      { name: 'deliveryLabel', label: 'Délai de livraison', wide: false,
        visibleWhen: (values) => values.deliveryKind === 'LEAD_TIME', required: (values) => values.deliveryKind === 'LEAD_TIME',
        defaultValue: initialDelivery === 'LEAD_TIME' ? pack.deliveryLabel || '' : '',
        help: 'Par exemple : « Galerie en ligne sous 5 jours ouvrés ».' },

      // Everything below is optional while the formula is a draft. The publication gate
      // refuses an incomplete public presentation, so nothing half-written reaches a client.
      { name: 'description', label: 'Résumé public', type: 'textarea', defaultValue: pack.description || '',
        help: 'Obligatoire pour publier.' },
      { name: 'content', label: 'Contenu de la formule', type: 'textarea', defaultValue: pack.content || '',
        help: 'Obligatoire pour publier ; au moins dix caractères.' },
      { name: 'inclusions', label: 'Inclusions — une par ligne', type: 'textarea', defaultValue: inclusionsText(pack),
        help: 'Obligatoire pour publier.' },
      { name: 'conditions', label: 'Conditions applicables', type: 'textarea', defaultValue: pack.conditions || '',
        help: 'Obligatoire pour publier ; au moins dix caractères.' },
      { name: 'legalText', label: 'Mentions obligatoires', type: 'textarea', defaultValue: pack.legalText || '',
        help: 'Obligatoires, et validées séparément avant publication.' },

      { name: 'effectiveAt', label: 'Date d’effet à Douala', type: 'datetime-local', required: true, wide: false,
        visibleWhen: advanced,
        defaultValue: pack.effectiveAt ? businessDateTimeLocalValue(pack.effectiveAt) : businessDateTimeLocalValue(new Date()),
        help: 'Par défaut maintenant. Une date future est acceptée, mais la publication est refusée tant qu’elle n’est pas atteinte.' },
      { name: 'sortOrder', label: 'Ordre d’affichage', type: 'number', min: '0', wide: false,
        visibleWhen: advanced, defaultValue: String(pack.sortOrder ?? 0),
        help: 'L’ordre se règle normalement avec les flèches de la liste.' },

      { name: 'englishEnabled', label: 'Catalogue anglais', type: 'select', required: true, wide: false,
        defaultValue: String(pack.englishEnabled ?? true),
        options: [{ value: 'true', label: 'Activé' }, { value: 'false', label: 'Désactivé' }] },
      { name: 'englishName', label: 'Nom anglais', wide: false, visibleWhen: wantsEnglish, defaultValue: localized(pack, 'en')?.name || '' },
      { name: 'englishDescription', label: 'Résumé anglais', type: 'textarea', visibleWhen: wantsEnglish, defaultValue: localized(pack, 'en')?.description || '' },
      { name: 'englishContent', label: 'Contenu anglais', type: 'textarea', visibleWhen: wantsEnglish, defaultValue: localized(pack, 'en')?.content || '' },
      { name: 'englishInclusions', label: 'Inclusions anglaises — une par ligne', type: 'textarea', visibleWhen: wantsEnglish,
        defaultValue: Array.isArray(localized(pack, 'en')?.inclusions) ? localized(pack, 'en').inclusions.join('\n') : '' },
      { name: 'englishConditions', label: 'Conditions anglaises', type: 'textarea', visibleWhen: wantsEnglish, defaultValue: localized(pack, 'en')?.conditions || '' },
      { name: 'englishDeliveryLabel', label: 'Délai de livraison anglais', wide: false, visibleWhen: wantsEnglish,
        defaultValue: localized(pack, 'en')?.deliveryLabel || '' },
      { name: 'englishMandatoryWording', label: 'Mentions obligatoires anglaises', type: 'textarea', visibleWhen: wantsEnglish,
        defaultValue: localized(pack, 'en')?.mandatoryWording || '' },

      { name: 'advanced', label: 'Réglages avancés', type: 'select', wide: false, defaultValue: 'false',
        options: [{ value: 'false', label: 'Masqués' }, { value: 'true', label: 'Affichés' }],
        help: 'Identifiant URL, date d’effet et ordre numérique.' },
    ];
  };
  /**
   * A locale row has to be complete or absent — the API refuses a half-filled one. So a
   * draft that is not finished simply carries no locale, and the existing translations
   * are preserved because the payload omits the field entirely rather than sending an
   * empty list.
   */
  const completeLocale = (locale) => Boolean(
    locale.name && locale.content.length >= 10 && locale.inclusions.length
    && locale.conditions.length >= 10 && locale.deliveryLabel && locale.mandatoryWording.length >= 10,
  );

  const draftPayload = (values) => {
    let effectiveAt;
    try { effectiveAt = doualaLocalDateTimeToIso(values.effectiveAt); }
    catch { throw new Error('La date d’effet est invalide.'); }
    const direct = values.bookingMode === 'DIRECT';
    if (direct && String(values.durationMin).trim() === '') {
      throw new Error('La durée est obligatoire pour une réservation directe.');
    }
    const englishEnabled = values.englishEnabled === 'true';
    const taxonomy = taxonomyOptions.find((item) => item.value === values.taxonomyKey);
    if (!taxonomy) throw new Error('Sélectionnez une section publique valide.');

    const lines = (value) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean);
    const delivery = values.deliveryKind === 'CONTACT' ? GENERIC_DELIVERY_CONTACT : String(values.deliveryLabel || '').trim();
    const englishDelivery = values.deliveryKind === 'CONTACT'
      ? GENERIC_DELIVERY_CONTACT_ENGLISH
      : String(values.englishDeliveryLabel || '').trim();

    const frenchLocale = { locale: 'fr', name: values.name.trim(), description: values.description.trim() || null, content: values.content.trim(), inclusions: lines(values.inclusions), conditions: values.conditions.trim(), deliveryLabel: delivery, mandatoryWording: values.legalText.trim(), sourceReference: 'ADMIN_EDITOR', approvedAt: null, isEnabled: true };
    const englishLocale = { locale: 'en', name: values.englishName.trim(), description: values.englishDescription.trim() || null, content: values.englishContent.trim(), inclusions: lines(values.englishInclusions), conditions: values.englishConditions.trim(), deliveryLabel: englishDelivery, mandatoryWording: values.englishMandatoryWording.trim(), sourceReference: 'ADMIN_EDITOR', approvedAt: null, isEnabled: true };

    const locales = [];
    if (completeLocale(frenchLocale)) locales.push(frenchLocale);
    if (englishEnabled && completeLocale(englishLocale)) locales.push(englishLocale);
    // An English catalogue that is switched on but not written yet is a draft in progress,
    // not an error: the publication gate is what refuses it.
    if (englishEnabled && locales.length === 1 && locales[0].locale === 'en') locales.length = 0;

    // The price shape is what the public page reads: `isRange` prints "À partir de", and
    // the suffix prints beside the amount. Choosing a shape rewrites both, so a formula
    // that stops being an subscription stops carrying subscription terms.
    const perMonth = values.priceKind === 'PER_MONTH';
    const options = perMonth
      ? { priceSuffix: '/ mois', subscription: { commitmentMonths: Number(values.commitmentMonths), sessionsPerMonth: Number(values.sessionsPerMonth) } }
      : null;

    return {
      name: values.name.trim(),
      slug: values.slug.trim(),
      category: taxonomy.label,
      taxonomyKey: values.taxonomyKey,
      englishEnabled,
      ...(locales.length ? { locales } : {}),
      price: Number(values.price),
      currency: values.currency,
      durationMin: direct ? Number(values.durationMin) : null,
      bookingMode: values.bookingMode,
      isRange: values.priceKind === 'FROM',
      options,
      description: values.description.trim() || null,
      content: values.content.trim() || null,
      inclusions: lines(values.inclusions).length ? lines(values.inclusions) : null,
      conditions: values.conditions.trim() || null,
      legalText: values.legalText.trim() || null,
      effectiveAt,
      deliveryLabel: delivery || null,
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
  /**
   * Move a formula one place in the catalogue.
   *
   * This used to write `sortOrder ± 1`. The catalogue is spaced in tens, so a formula at
   * 20 moved to 19 and did not move at all — the arrows looked like they worked and
   * changed nothing. Order belongs to the list, so the whole sequence is sent and the
   * server rewrites it.
   */
  const orderedPacks = packs.filter((item) => !item.isArchived);
  const moveItem = (pack, direction) => {
    const index = orderedPacks.findIndex((item) => item.id === pack.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedPacks.length) return;
    const ids = orderedPacks.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const neighbour = orderedPacks[target];
    simpleAction({
      title: direction < 0 ? 'Monter dans le catalogue' : 'Descendre dans le catalogue',
      summary: `${pack.name} passe ${direction < 0 ? 'avant' : 'après'} ${neighbour.name}.`,
      consequence: 'Seul l’ordre public change ; aucune version tarifaire n’est créée.',
    }, 'Déplacer la formule', () => reorderAdminPackages(ids));
  };
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
        <button className="btn btn-primary admin-sm-btn" onClick={createItem} disabled={taxonomyOptions.length === 0}
          title={taxonomyOptions.length === 0 ? 'Les rubriques publiques n’ont pas pu être chargées.' : undefined}>Créer un brouillon</button>
      </div>
      <div className="admin-card">
        {packs.map((pack) => (
          <div key={pack.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', padding: '1.5rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div>
              <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{pack.name}</strong>
              <small style={{ color: 'var(--dark-muted)', display: 'block', marginTop: '0.25rem' }}>{pack.category}</small>
              <small style={{ color: 'var(--dark-secondary)', display: 'block', marginTop: '0.35rem' }}>{formatFcfa(pack.price)} · {pack.bookingMode === 'CONTACT' ? 'sur échange' : `${pack.durationMin} min`} · version {pack.version} · ordre {pack.sortOrder}</small>
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>{pill(pack.publicationStatus || (pack.isArchived ? 'ARCHIVED' : 'DRAFT'))} {countChip(packageReferenceCount(pack))}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => setPreviewPack(pack)}>Aperçu avant publication</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => editItem(pack)} disabled={editingPack === pack.id}>{editingPack === pack.id ? 'Modification...' : 'Modifier le brouillon'}</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => duplicateItem(pack)}>Dupliquer</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => moveItem(pack, -1)}
                disabled={orderedPacks[0]?.id === pack.id} aria-label={`Monter ${pack.name}`}>↑</button>
              <button className="btn btn-secondary admin-sm-btn" onClick={() => moveItem(pack, 1)}
                disabled={orderedPacks[orderedPacks.length - 1]?.id === pack.id} aria-label={`Descendre ${pack.name}`}>↓</button>
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
              <div className="admin-modal-info-row"><span>Réservation :</span><strong>{previewPack.bookingMode === 'CONTACT' ? 'Prise de contact' : 'Directe'}</strong></div>
              <div className="admin-modal-info-row"><span>Durée :</span><strong>{previewPack.durationMin === null ? 'Définie lors de l’échange' : `${previewPack.durationMin} minutes`}</strong></div>
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
