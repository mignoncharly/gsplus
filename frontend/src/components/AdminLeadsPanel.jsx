import { statusLabel } from '../lib/status-labels';

const pill = (status) => <span className={'admin-pill pill-' + String(status).toLowerCase()}>{statusLabel(status)}</span>;

const AdminLeadsPanel = ({ leads, cardRefs, onStatusChange }) => (
  <>
    <div className="admin-page-header"><h1>Demandes <span>B2B / Leads</span></h1></div>
    <div className="admin-card">
      {leads.length === 0 && <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>Aucune demande reçue pour le moment.</p>}
      {leads.map((lead) => (
        <div key={lead.id} className="admin-lead-card" data-lead-reference={lead.reference} tabIndex="-1" ref={(element) => { if (element) cardRefs.current.set(lead.reference, element); else cardRefs.current.delete(lead.reference); }}>
          <div className="admin-lead-header">
            <div><h3>{lead.company || lead.name}</h3><code className="admin-public-reference">{lead.reference}</code><p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', margin: 0 }}>{lead.email || "Pas d'email"} | {lead.phone || 'Pas de téléphone'}</p></div>
            <div className="admin-lead-badges">{pill(lead.type || 'B2B')}{pill(lead.status)}</div>
          </div>
          <p style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '1rem' }}><strong>Sujet :</strong> {lead.subject || lead.source}</p>
          <div className="admin-lead-message">{lead.message}</div>
          <div className="admin-action-row">{['IN_PROGRESS', 'WON', 'LOST', 'ARCHIVED'].map((status) => <button key={status} type="button" className="btn btn-secondary admin-sm-btn" onClick={() => onStatusChange(lead, status)}>{statusLabel(status)}</button>)}</div>
        </div>
      ))}
    </div>
  </>
);

export default AdminLeadsPanel;
