import { useState } from 'react';

import {
  createAdminCatalogueBenefit,
  publishAdminCatalogueBenefit,
  updateAdminCatalogueBenefit,
  updateAdminCatalogueTaxonomy,
  validateAdminCatalogueBenefit,
} from '../lib/api';
import { statusLabel } from '../lib/admin-workflow';
import AdminActionDialog from './AdminActionDialog';
import './AdminCatalogueSectionsPanel.css';

const localeOf = (record, locale) => record?.locales?.find((item) => item.locale === locale) || null;
const currentVersion = (benefit) => benefit?.versions?.[0] || null;

/**
 * The two halves of the catalogue that had a complete API and no screen at all.
 *
 * Sections are the controlled list the tariff form files a formula under, so they are
 * edited here rather than invented inside a formula. Privileges carry the tariff shapes a
 * formula cannot express — a percentage, or an advantage for two people — which is why
 * the tariff form points here for those.
 */
const AdminCatalogueSectionsPanel = ({ taxonomy = [], benefits = [], onRefresh, onFeedback }) => {
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState('');

  const run = async (label, action) => {
    setBusy(label);
    try {
      await action();
      onFeedback?.({ tab: 'tarifs', type: 'success', message: `${label} : enregistré.` });
      await onRefresh?.();
      return true;
    } catch (error) {
      onFeedback?.({ tab: 'tarifs', type: 'error', message: error.message || `${label} : échec.` });
      return false;
    } finally {
      setBusy('');
    }
  };

  const editSection = (section) => {
    const fr = localeOf(section, 'fr');
    const en = localeOf(section, 'en');
    setDialog({
      title: `Rubrique — ${fr?.label || section.key}`,
      summary: `Identifiant technique : ${section.key}`,
      consequence: 'Le libellé et l’ordre changent sur la page publique. Désactiver une rubrique la retire du public ; les formules qu’elle contient ne sont pas supprimées.',
      confirmLabel: 'Enregistrer la rubrique',
      fields: [
        { name: 'fr', label: 'Libellé français', required: true, defaultValue: fr?.label || '' },
        { name: 'en', label: 'Libellé anglais', required: true, defaultValue: en?.label || '' },
        { name: 'sortOrder', label: 'Ordre', type: 'number', min: '0', required: true, wide: false, defaultValue: String(section.sortOrder ?? 0) },
        { name: 'isActive', label: 'Visible sur le site', type: 'select', required: true, wide: false,
          defaultValue: section.isActive ? 'true' : 'false',
          options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] },
      ],
      onConfirm: (values) => run(`Rubrique ${section.key}`, () => updateAdminCatalogueTaxonomy(section.key, {
        sortOrder: Number(values.sortOrder),
        isActive: values.isActive === 'true',
        labels: { fr: values.fr.trim(), en: values.en.trim() },
      })),
    });
  };

  const benefitFields = (benefit) => {
    const version = currentVersion(benefit);
    const fr = localeOf(version, 'fr');
    const en = localeOf(version, 'en');
    return [
      ...(benefit ? [] : [{ name: 'code', label: 'Code technique', required: true, wide: false, defaultValue: '',
        help: 'Majuscules, chiffres et soulignés. Il ne change plus ensuite.',
        validate: (value) => /^[A-Z0-9_]{2,50}$/.test(String(value)) ? '' : 'Utilisez des majuscules, chiffres et soulignés.' }]),
      { name: 'taxonomyKey', label: 'Rubrique', type: 'select', required: true, wide: false,
        defaultValue: version?.taxonomyKey || 'privileges-golden-promotion',
        options: taxonomy.filter((item) => item.isActive).map((item) => ({ value: item.key, label: localeOf(item, 'fr')?.label || item.key })) },
      { name: 'applicationMode', label: 'Mode d’application', type: 'select', required: true, wide: false,
        defaultValue: version?.applicationMode || 'MANUAL_CONTACT',
        options: [{ value: 'MANUAL_CONTACT', label: 'Vérifié avec l’équipe lors de l’échange' }],
        help: 'Le studio applique l’avantage à la main ; rien n’est déduit automatiquement.' },
      { name: 'sortOrder', label: 'Ordre', type: 'number', min: '0', required: true, wide: false, defaultValue: String(version?.sortOrder ?? 10) },
      { name: 'frName', label: 'Nom français', required: true, defaultValue: fr?.name || '' },
      // This is where a percentage or a double advantage is written, which is why it is
      // free text: "−15 %" and "3 000 / 5 000 FCFA" are both legitimate.
      { name: 'frAdvantage', label: 'Avantage français', required: true, wide: false, defaultValue: fr?.advantage || '',
        help: 'Par exemple « −15 % » ou « 3 000 / 5 000 FCFA » pour un avantage partagé.' },
      { name: 'frApplicationLabel', label: 'Application française', required: true, defaultValue: fr?.applicationLabel || '' },
      { name: 'frConditions', label: 'Conditions françaises', type: 'textarea', required: true, defaultValue: fr?.conditions || '' },
      { name: 'frMandatoryWording', label: 'Mentions obligatoires françaises', type: 'textarea', required: true, defaultValue: fr?.mandatoryWording || '' },
      { name: 'enName', label: 'Nom anglais', required: true, defaultValue: en?.name || '' },
      { name: 'enAdvantage', label: 'Avantage anglais', required: true, wide: false, defaultValue: en?.advantage || '' },
      { name: 'enApplicationLabel', label: 'Application anglaise', required: true, defaultValue: en?.applicationLabel || '' },
      { name: 'enConditions', label: 'Conditions anglaises', type: 'textarea', required: true, defaultValue: en?.conditions || '' },
      { name: 'enMandatoryWording', label: 'Mentions obligatoires anglaises', type: 'textarea', required: true, defaultValue: en?.mandatoryWording || '' },
    ];
  };

  const benefitPayload = (values) => ({
    taxonomyKey: values.taxonomyKey,
    applicationMode: values.applicationMode,
    sortOrder: Number(values.sortOrder),
    effectiveAt: null,
    locales: [
      { locale: 'fr', name: values.frName.trim(), advantage: values.frAdvantage.trim(), conditions: values.frConditions.trim(),
        applicationLabel: values.frApplicationLabel.trim(), mandatoryWording: values.frMandatoryWording.trim(), sourceReference: 'ADMIN_EDITOR' },
      { locale: 'en', name: values.enName.trim(), advantage: values.enAdvantage.trim(), conditions: values.enConditions.trim(),
        applicationLabel: values.enApplicationLabel.trim(), mandatoryWording: values.enMandatoryWording.trim(), sourceReference: 'ADMIN_EDITOR' },
    ],
  });

  const createBenefit = () => setDialog({
    title: 'Nouveau privilège',
    summary: 'Un privilège porte un avantage — un pourcentage, un montant, un avantage partagé — hors du tarif d’une formule.',
    consequence: 'Le privilège est créé en brouillon ; rien n’est public avant validation puis publication.',
    confirmLabel: 'Créer le brouillon',
    fields: benefitFields(null),
    onConfirm: (values) => run('Création du privilège', () => createAdminCatalogueBenefit({ code: values.code.trim(), ...benefitPayload(values) })),
  });

  const editBenefit = (benefit) => {
    const version = currentVersion(benefit);
    setDialog({
      title: `Privilège — ${localeOf(version, 'fr')?.name || benefit.code}`,
      summary: `Code ${benefit.code} · version ${version?.version ?? 1}`,
      consequence: 'Une nouvelle version brouillon est créée ; la version publiée reste en ligne jusqu’à la publication.',
      confirmLabel: 'Enregistrer le brouillon',
      fields: benefitFields(benefit),
      onConfirm: (values) => run(`Privilège ${benefit.code}`, () => updateAdminCatalogueBenefit(benefit.id, {
        expectedVersion: version?.version ?? 1, ...benefitPayload(values),
      })),
    });
  };

  const simple = (title, summary, consequence, label, action) => setDialog({
    title, summary, consequence, confirmLabel: label, fields: [], onConfirm: () => run(label, action),
  });

  return (
    <>
      <div className="admin-page-header"><h1>Rubriques <span>publiques</span></h1></div>
      <p className="admin-record-hint">
        Les rubriques sont la liste dans laquelle une formule se range. Elles se modifient ici, jamais depuis une
        formule. Ajouter une neuvième rubrique demande une intervention technique : la liste est fermée côté serveur.
      </p>
      <ul className="admin-section-list">
        {taxonomy.map((section) => (
          <li key={section.key} className="admin-card admin-section-row">
            <div>
              <h2>{localeOf(section, 'fr')?.label || section.key}</h2>
              <small>{localeOf(section, 'en')?.label || '—'} · ordre {section.sortOrder} · <code>{section.key}</code></small>
            </div>
            <div className="admin-action-row">
              <span className={`admin-pill ${section.isActive ? 'pill-published' : 'pill-archived'}`}>
                {section.isActive ? 'Visible' : 'Masquée'}
              </span>
              <button type="button" className="btn btn-secondary admin-sm-btn" disabled={Boolean(busy)}
                aria-label={`Modifier la rubrique ${localeOf(section, 'fr')?.label || section.key}`}
                onClick={() => editSection(section)}>Modifier</button>
            </div>
          </li>
        ))}
      </ul>

      <div className="admin-page-header">
        <h1>Privilèges <span>Golden</span></h1>
        <button type="button" className="btn btn-primary admin-sm-btn" onClick={createBenefit}>Créer un privilège</button>
      </div>
      <p className="admin-record-hint">
        Un privilège porte un avantage que le tarif d’une formule ne peut pas exprimer : un pourcentage, ou un
        avantage partagé entre deux personnes. Il suit le même cycle qu’une formule — brouillon, validation des
        mentions, publication.
      </p>
      <ul className="admin-section-list">
        {benefits.map((benefit) => {
          const version = currentVersion(benefit);
          const fr = localeOf(version, 'fr');
          return (
            <li key={benefit.id} className="admin-card admin-section-row">
              <div>
                <h2>{fr?.name || benefit.code}</h2>
                <small><strong>{fr?.advantage || '—'}</strong> · {fr?.applicationLabel || 'Application non renseignée'}</small>
                <small><code>{benefit.code}</code> · version {version?.version ?? 1}</small>
              </div>
              <div className="admin-action-row">
                <span className={`admin-pill pill-${String(version?.status || 'DRAFT').toLowerCase()}`}>{statusLabel(version?.status || 'DRAFT')}</span>
                <button type="button" className="btn btn-secondary admin-sm-btn" disabled={Boolean(busy)}
                  aria-label={`Modifier le privilège ${fr?.name || benefit.code}`}
                  onClick={() => editBenefit(benefit)}>Modifier</button>
                {version?.status === 'DRAFT' && (
                  <button type="button" className="btn btn-secondary admin-sm-btn" disabled={Boolean(busy)}
                    aria-label={`Valider les mentions du privilège ${fr?.name || benefit.code}`}
                    onClick={() => simple(`Valider les mentions — ${benefit.code}`, fr?.name || benefit.code,
                      'La validation atteste que les mentions obligatoires ont été relues.', 'Valider les mentions',
                      () => validateAdminCatalogueBenefit(benefit.id, version.version))}>Valider les mentions</button>
                )}
                {version?.status === 'VALIDATED' && (
                  <button type="button" className="btn btn-primary admin-sm-btn" disabled={Boolean(busy)}
                    aria-label={`Publier le privilège ${fr?.name || benefit.code}`}
                    onClick={() => simple(`Publier — ${benefit.code}`, fr?.name || benefit.code,
                      'Le privilège devient visible sur la page publique.', 'Publier le privilège',
                      () => publishAdminCatalogueBenefit(benefit.id, version.version))}>Publier</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {dialog && <AdminActionDialog config={dialog} onClose={() => setDialog(null)} />}
    </>
  );
};

export default AdminCatalogueSectionsPanel;
