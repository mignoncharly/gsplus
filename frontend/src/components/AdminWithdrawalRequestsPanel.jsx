import React from 'react';

const channelLabels = {
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Téléphone',
  IN_PERSON: 'En personne',
  OTHER: 'Autre canal professionnel',
};

const serviceLabels = {
  NOT_STARTED: 'Service non commencé',
  STARTED: 'Service commencé',
  COMPLETED: 'Service achevé',
};

const AdminWithdrawalRequestsPanel = ({
  requests = [],
  dateTime,
  pill,
  busy,
  ownerDisabled,
  onDecision,
}) => {
  if (requests.length === 0) return null;
  return (
    <div className="admin-modal-block" style={{ borderLeftColor: '#9f7aea' }}>
      <strong>Demandes de rétractation</strong>
      {requests.map((request) => (
        <div key={request.id} style={{ marginTop: '0.9rem' }}>
          <p style={{ margin: 0 }}>
            {pill(request.status)} · reçue le {dateTime(request.receivedAt)} par {channelLabels[request.requestChannel] || request.requestChannel}
            <br /><small>
              Contrat conclu le {dateTime(request.contractConcludedAt)} · échéance indicative le {dateTime(request.legalDeadlineAt)} ·{' '}
              {request.receivedWithinLegalWindow ? 'reçue dans la fenêtre de 15 jours' : 'reçue hors de la fenêtre de 15 jours'}
            </small>
            <br /><small>{serviceLabels[request.serviceStatus] || request.serviceStatus}
              {request.executionStartedAt ? ` · début ${dateTime(request.executionStartedAt)}` : ''}
            </small>
            <br /><small>Demande : {request.requestText}</small>
            <br /><small>Preuve : {request.requestEvidence}</small>
            {request.decisionReason && <><br /><small>Décision motivée : {request.decisionReason}</small></>}
          </p>
          {request.status === 'PENDING' && (
            <>
              <p className="admin-action-dialog-help">La décision reste humaine. Elle n’annule pas automatiquement la réservation et ne marque aucun remboursement comme effectué.</p>
              <div className="admin-action-row" style={{ marginTop: '0.6rem' }}>
                <button
                  className="btn btn-primary admin-sm-btn"
                  onClick={() => onDecision(request, 'ACCEPTED')}
                  disabled={busy || ownerDisabled}
                >
                  Accepter la rétractation
                </button>
                <button
                  className="btn btn-secondary admin-sm-btn text-danger"
                  onClick={() => onDecision(request, 'REJECTED')}
                  disabled={busy || ownerDisabled}
                >
                  Refuser la rétractation
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminWithdrawalRequestsPanel;
