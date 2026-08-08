import React, { useState } from 'react';

import { isDeliveryAccessActive } from '../lib/admin-workflow';
import { publishAdminReservationDelivery } from '../lib/api';

const AdminDeliveriesPanel = ({ reservation, busy, ownerDisabled, dateTime, onPublished }) => {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (reservation.status !== 'COMPLETED') return null;
  const activeDelivery = reservation.deliveries?.find((delivery) => isDeliveryAccessActive(delivery));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const expiresOn = String(form.get('expiresOn') || '');
    if (!expiresOn) {
      setError('La date limite d’accès est obligatoire.');
      return;
    }
    setSubmitting(true);
    try {
      await publishAdminReservationDelivery(reservation.id, {
        commandId: window.crypto.randomUUID(),
        expectedReservationVersion: reservation.version,
        deliveryUrl: String(form.get('deliveryUrl') || '').trim(),
        accessInstruction: String(form.get('accessInstruction') || '').trim(),
        expiresAt: `${expiresOn}T22:59:59+01:00`,
      });
      await onPublished();
      event.currentTarget.reset();
    } catch (failure) {
      setError(failure.message || 'La publication a échoué.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-modal-block" style={{ borderLeftColor: '#4a9ca8' }}>
      <strong>Livraison des éléments</strong>
      {reservation.deliveries?.map((delivery) => (
        <p key={delivery.id} style={{ margin: '0.75rem 0 0' }}>
          <a href={delivery.deliveryUrl} target="_blank" rel="noreferrer">Ouvrir le lien vérifié</a>
          <br /><small>Vérifié le {dateTime(delivery.verifiedAt)} · accès jusqu’au {dateTime(delivery.expiresAt)}</small>
          <br /><small>Statut HTTP vérifié : {delivery.verificationStatusCode}</small>
        </p>
      ))}
      {!activeDelivery && (
        <form onSubmit={submit} className="admin-form-grid" style={{ marginTop: '1rem' }}>
          <label>
            Lien HTTPS des livrables
            <input name="deliveryUrl" type="url" required maxLength={2000} placeholder="https://…" />
          </label>
          <label>
            Date limite d’accès
            <input name="expiresOn" type="date" required />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            Code ou instruction d’accès
            <textarea name="accessInstruction" required maxLength={1000} rows={3} />
          </label>
          {error && <p role="alert" style={{ gridColumn: '1 / -1', color: '#ff8b8b', margin: 0 }}>{error}</p>}
          <button
            className="btn btn-primary admin-sm-btn"
            type="submit"
            disabled={busy || submitting || ownerDisabled}
            title={ownerDisabled ? 'La publication nécessite le rôle propriétaire.' : undefined}
          >
            Vérifier le lien et informer le client
          </button>
        </form>
      )}
    </div>
  );
};

export default AdminDeliveriesPanel;
