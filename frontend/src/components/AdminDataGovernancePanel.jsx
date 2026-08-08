import './AdminDataGovernancePanel.css';
import React, { useState } from 'react';

const rightLabels = {
  ACCESS: 'Accès',
  RECTIFICATION: 'Rectification',
  RESTRICTION: 'Limitation',
  OBJECTION: 'Opposition',
  PORTABILITY: 'Portabilité',
  CONSENT_WITHDRAWAL: 'Retrait du consentement',
  ERASURE: 'Effacement',
};
const statusLabels = {
  RECEIVED: 'Reçue',
  IDENTITY_CHECK: 'Vérification d’identité',
  IN_REVIEW: 'En instruction',
  ACTION_REQUIRED: 'Action requise',
  PARTIALLY_FULFILLED: 'Partiellement satisfaite',
  FULFILLED: 'Satisfaite',
  REFUSED: 'Refusée',
  CLOSED: 'Clôturée',
};
const retentionLabels = {
  NONE: 'Aucune décision',
  KEEP_ACTIVE: 'Maintien actif justifié',
  RESTRICTED_ARCHIVE: 'Archivage restreint',
  ANONYMIZATION_REQUIRED: 'Anonymisation à exécuter',
  ERASURE_REQUIRED: 'Effacement à exécuter',
  LEGAL_HOLD: 'Gel juridique',
};
const inputDateTime = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const asIso = (value) => new Date(value).toISOString();

const RequestUpdateForm = ({ request, busy, onUpdate }) => {
  const [form, setForm] = useState({
    status: request.status,
    identityStatus: request.identityStatus,
    identityEvidenceReference: request.identityEvidenceReference || '',
    processingRestricted: request.processingRestricted,
    retentionAction: request.retentionAction,
    reason: '',
    responseEvidence: request.responseEvidence || '',
    legalHoldUntil: '',
    effectiveAt: inputDateTime(),
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    onUpdate(request, {
      commandId: crypto.randomUUID(),
      expectedVersion: request.version,
      ...form,
      identityEvidenceReference: form.identityEvidenceReference || null,
      responseEvidence: form.responseEvidence || null,
      legalHoldUntil: form.legalHoldUntil ? asIso(form.legalHoldUntil) : null,
      effectiveAt: asIso(form.effectiveAt),
    });
  };
  return (
    <form onSubmit={submit} className="admin-governance-update-form">
      <div className="admin-form-grid">
        <label>État
          <select value={form.status} onChange={(event) => update('status', event.target.value)}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Vérification d’identité
          <select value={form.identityStatus} onChange={(event) => update('identityStatus', event.target.value)}>
            <option value="UNVERIFIED">Non vérifiée</option>
            <option value="PENDING">À vérifier</option>
            <option value="VERIFIED">Vérifiée</option>
            <option value="NOT_REQUIRED">Non requise</option>
          </select>
        </label>
        <label>Décision de conservation
          <select value={form.retentionAction} onChange={(event) => update('retentionAction', event.target.value)}>
            {Object.entries(retentionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Date de décision
          <input type="datetime-local" required value={form.effectiveAt} onChange={(event) => update('effectiveAt', event.target.value)} />
        </label>
        {form.retentionAction === 'LEGAL_HOLD' && (
          <label>Fin du gel juridique
            <input type="datetime-local" required value={form.legalHoldUntil} onChange={(event) => update('legalHoldUntil', event.target.value)} />
          </label>
        )}
      </div>
      <label className="admin-checkbox-row">
        <input type="checkbox" checked={form.processingRestricted} onChange={(event) => update('processingRestricted', event.target.checked)} />
        Limiter les nouveaux traitements pendant l’instruction
      </label>
      <label>Référence de vérification d’identité
        <input value={form.identityEvidenceReference} onChange={(event) => update('identityEvidenceReference', event.target.value)} placeholder="Ex. contrôle visuel du 08/08/2026" />
      </label>
      <label>Motif détaillé
        <textarea required minLength="10" value={form.reason} onChange={(event) => update('reason', event.target.value)} />
      </label>
      <label>Preuve de réponse ou d’exécution
        <input value={form.responseEvidence} onChange={(event) => update('responseEvidence', event.target.value)} placeholder="Ex. courriel envoyé, ticket ou emplacement de preuve" />
      </label>
      <button type="submit" className="btn btn-primary admin-sm-btn" disabled={busy}>
        {busy ? 'Enregistrement…' : 'Enregistrer la décision'}
      </button>
    </form>
  );
};

const AdminDataGovernancePanel = ({ governance = { policies: [], requests: [] }, dateTime, busy, onCreate, onUpdate }) => {
  const [form, setForm] = useState({
    requestType: 'ACCESS',
    requesterName: '',
    requesterEmail: '',
    requesterPhone: '',
    reservationReference: '',
    requestChannel: 'EMAIL',
    requestSummary: '',
    identityStatus: 'UNVERIFIED',
    identityEvidenceReference: '',
    receivedAt: inputDateTime(),
    targetResponseAt: '',
  });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    onCreate({
      commandId: crypto.randomUUID(),
      ...form,
      requesterEmail: form.requesterEmail || undefined,
      requesterPhone: form.requesterPhone || undefined,
      reservationReference: form.reservationReference || undefined,
      identityEvidenceReference: form.identityEvidenceReference || undefined,
      receivedAt: asIso(form.receivedAt),
      targetResponseAt: asIso(form.targetResponseAt),
    });
  };
  return (
    <section aria-labelledby="data-governance-title">
      <div className="admin-page-header">
        <h1 id="data-governance-title">Données, <span>droits & conservation</span></h1>
        <p>Registre confidentiel réservé au propriétaire.</p>
      </div>

      <div className="admin-governance-notice" role="note">
        <strong>Aucune suppression automatique.</strong> Toute anonymisation ou tout effacement reste une action à exécuter après revue des obligations, preuves, litiges et sauvegardes. Une échéance saisie ici est une cible opérationnelle, pas un délai légal inventé.
      </div>

      <div className="admin-form-card">
        <h2>Nouvelle demande de droits</h2>
        <p className="admin-action-dialog-help"><strong>Ne déposez aucune copie de pièce d’identité.</strong> Notez seulement la méthode, la date ou l’emplacement restreint de la preuve.</p>
        <form onSubmit={submit} className="admin-governance-create-form">
          <div className="admin-form-grid">
            <label>Droit exercé
              <select value={form.requestType} onChange={(event) => update('requestType', event.target.value)}>
                {Object.entries(rightLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Canal
              <select value={form.requestChannel} onChange={(event) => update('requestChannel', event.target.value)}>
                {['EMAIL', 'WHATSAPP', 'PHONE', 'IN_PERSON', 'MAIL', 'OTHER'].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Nom du demandeur
              <input required minLength="2" value={form.requesterName} onChange={(event) => update('requesterName', event.target.value)} />
            </label>
            <label>Courriel
              <input type="email" value={form.requesterEmail} onChange={(event) => update('requesterEmail', event.target.value)} />
            </label>
            <label>Téléphone
              <input value={form.requesterPhone} onChange={(event) => update('requesterPhone', event.target.value)} />
            </label>
            <label>Référence réservation
              <input value={form.reservationReference} onChange={(event) => update('reservationReference', event.target.value)} />
            </label>
            <label>Reçue le
              <input type="datetime-local" required value={form.receivedAt} onChange={(event) => update('receivedAt', event.target.value)} />
            </label>
            <label>Échéance interne à confirmer
              <input type="datetime-local" required value={form.targetResponseAt} onChange={(event) => update('targetResponseAt', event.target.value)} />
            </label>
          </div>
          <label>Demande reçue
            <textarea required minLength="10" value={form.requestSummary} onChange={(event) => update('requestSummary', event.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Création…' : 'Créer la demande'}</button>
        </form>
      </div>

      <div className="admin-section-header"><h2>Demandes de droits</h2></div>
      <div className="admin-governance-list">
        {governance.requests.length === 0 && <p>Aucune demande enregistrée.</p>}
        {governance.requests.map((request) => (
          <article key={request.id} className="admin-form-card admin-governance-request">
            <div className="admin-governance-heading">
              <div><strong>{request.reference}</strong> · {rightLabels[request.requestType] || request.requestType}</div>
              <span className="admin-pill">{statusLabels[request.status] || request.status}</span>
            </div>
            <p>{request.requesterName} · reçue {dateTime(request.receivedAt)} · échéance {dateTime(request.targetResponseAt)}</p>
            <p>{request.requestSummary}</p>
            <p><strong>{retentionLabels[request.retentionAction] || request.retentionAction}</strong>{request.processingRestricted ? ' · traitements limités' : ''}</p>
            <RequestUpdateForm request={request} busy={busy} onUpdate={onUpdate} />
            <details><summary>Historique immuable ({request.events.length})</summary>
              {request.events.map((item) => <p key={item.id}><small>{dateTime(item.effectiveAt)} · {statusLabels[item.toStatus] || item.toStatus} · {item.reason} · {item.recordedBy?.name}</small></p>)}
            </details>
          </article>
        ))}
      </div>

      <details className="admin-form-card admin-governance-policies">
        <summary>Politiques de conservation publiées ({governance.policies.length})</summary>
        {governance.policies.map((policy) => (
          <article key={policy.id}>
            <h3>{policy.label}</h3>
            <p><strong>Déclencheur :</strong> {policy.triggerRule}</p>
            <p><strong>Actif :</strong> {policy.activeRule}</p>
            <p><strong>Archivage restreint :</strong> {policy.archiveRule}</p>
            <p><strong>Sort final :</strong> {policy.dispositionRule}</p>
            <p><strong>Sauvegardes :</strong> {policy.backupRule}</p>
          </article>
        ))}
      </details>
    </section>
  );
};

export default AdminDataGovernancePanel;
