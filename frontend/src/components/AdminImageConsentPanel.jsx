import React from 'react';

const choiceLabels = {
  GRANTED: 'Autorisation active',
  REFUSED: 'Autorisation refusée',
  WITHDRAWN: 'Autorisation retirée',
};

const scopeLabels = {
  WEBSITE: 'site web',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
};

const AdminImageConsentPanel = ({
  events = [],
  dateTime,
  busy,
  ownerDisabled,
  onRecord,
}) => {
  const current = events[0] || null;
  const active = current?.choice === 'GRANTED';
  return (
    <div className="admin-modal-block" style={{ borderLeftColor: active ? '#3fa36c' : '#9f7aea' }}>
      <strong>Historique du droit à l’image</strong>
      <p style={{ margin: '0.5rem 0 0' }}>
        État applicable : <strong>{choiceLabels[current?.choice] || 'Aucune preuve disponible'}</strong>
      </p>
      {current && (
        <p style={{ margin: '0.35rem 0 0' }}>
          <small>Finalité : Portfolio et promotion du Studio</small><br />
          <small>Portée : {(Array.isArray(current.scope) ? current.scope : []).map((item) => scopeLabels[item] || item).join(', ') || '—'}</small><br />
          <small>Version : {current.legalVersion?.version || '—'} · effet le {dateTime(current.effectiveAt)}</small>
        </p>
      )}
      <p className="admin-action-dialog-help">
        Un retrait cesse les nouvelles utilisations pour l’avenir et n’efface pas les preuves antérieures ni les autres données nécessaires au dossier.
      </p>
      <div className="admin-action-row" style={{ marginTop: '0.6rem' }}>
        <button
          className={`btn ${active ? 'btn-secondary text-danger' : 'btn-primary'} admin-sm-btn`}
          onClick={() => onRecord(active ? 'WITHDRAWN' : 'GRANTED', current)}
          disabled={busy || ownerDisabled}
          title={ownerDisabled ? 'Cette action nécessite le rôle propriétaire.' : undefined}
        >
          {active ? 'Enregistrer le retrait image' : 'Enregistrer une autorisation image'}
        </button>
      </div>
      {events.map((event) => (
        <p key={event.id} style={{ margin: '0.75rem 0 0' }}>
          <span>{choiceLabels[event.choice] || event.choice}</span><br />
          <small>{dateTime(event.effectiveAt)} · {event.source === 'PUBLIC_BOOKING' ? 'choix public' : event.source === 'HISTORICAL_SNAPSHOT' ? 'reprise historique' : 'choix client enregistré'}</small>
          {event.recordedBy?.name && <><br /><small>Enregistré par {event.recordedBy.name}</small></>}
        </p>
      ))}
    </div>
  );
};

export default AdminImageConsentPanel;
