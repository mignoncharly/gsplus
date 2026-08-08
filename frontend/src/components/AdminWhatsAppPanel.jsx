import { MessageCircle } from 'lucide-react';

import { buildWhatsAppCustomerLink } from '../lib/admin-workflow';
import { formatBusinessDateTime } from '../lib/business-time';

const AdminWhatsAppPanel = ({ reservation }) => {
  const snapshot = reservation?.snapshot;
  const allowed = Boolean(snapshot?.whatsappConsent);
  const link = buildWhatsAppCustomerLink(reservation);
  const consentLabel = allowed
    ? `Accordé${snapshot.whatsappConsentAt ? ` le ${formatBusinessDateTime(snapshot.whatsappConsentAt)}` : ''}`
    : 'Non accordé — aucun message client autorisé';

  return (
    <>
      <div className="admin-modal-info-row">
        <span>Consentement WhatsApp :</span>
        <strong>{consentLabel}</strong>
      </div>
      <div className="admin-modal-block" style={{ borderLeftColor: '#25D366' }}>
        <strong>Contact WhatsApp client</strong>
        <div className="admin-action-row" style={{ marginTop: '0.75rem' }}>
          {link ? (
            <a
              className="btn btn-primary admin-sm-btn"
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Écrire au client sur WhatsApp pour la réservation ${reservation.reference}`}
            >
              <MessageCircle size={14} /> Écrire au client sur WhatsApp
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-secondary admin-sm-btn"
              disabled
              title="Action indisponible : aucun consentement WhatsApp figé pour cette réservation."
            >
              <MessageCircle size={14} /> WhatsApp non autorisé
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminWhatsAppPanel;
