import React from 'react';

const AdminRescheduleRequestsPanel = ({
  requests = [],
  dateTime,
  pill,
  busy,
  ownerDisabled,
  onDecision,
}) => {
  if (requests.length === 0) return null;
  return (
    <div className="admin-modal-block" style={{ borderLeftColor: '#c5923a' }}>
      <strong>Demandes de report</strong>
      {requests.map((request) => (
        <div key={request.id} style={{ marginTop: '0.9rem' }}>
          <p style={{ margin: 0 }}>
            {pill(request.status)} · {dateTime(request.oldStartAt)} → {dateTime(request.requestedStartAt)}
            <br /><small>Demande : {request.reason}</small>
            {request.decisionReason && <><br /><small>Décision : {request.decisionReason}</small></>}
          </p>
          {request.status === 'PENDING' && (
            <div className="admin-action-row" style={{ marginTop: '0.6rem' }}>
              <button
                className="btn btn-primary admin-sm-btn"
                onClick={() => onDecision(request, 'ACCEPTED')}
                disabled={busy || ownerDisabled}
              >
                Accepter le report
              </button>
              <button
                className="btn btn-secondary admin-sm-btn text-danger"
                onClick={() => onDecision(request, 'REJECTED')}
                disabled={busy || ownerDisabled}
              >
                Refuser le report
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AdminRescheduleRequestsPanel;
