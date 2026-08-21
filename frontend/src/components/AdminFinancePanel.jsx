import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, WalletCards } from 'lucide-react';
import { formatBusinessDateTime } from '../lib/business-time';
import { formatFcfa } from '../lib/display-formatters';
import { paymentMethodLabel } from '../lib/status-labels';
import { getAdminFinancialTask, getAdminFinancialTasks, refundAdminPayment } from '../lib/api';
import './AdminFinancePanel.css';

const labels = { PENDING: 'À traiter', IN_PROGRESS: 'En cours', COMPLETED: 'Terminée', FAILED: 'En échec' };
const clientName = (task) => task.reservation.snapshot
  ? `${task.reservation.snapshot.firstName} ${task.reservation.snapshot.lastName}`
  : `${task.reservation.customer.firstName} ${task.reservation.customer.lastName}`;
const isOverdue = (task) => ['PENDING', 'IN_PROGRESS'].includes(task.status) && new Date(task.dueAt).getTime() < Date.now();

const AdminFinanceView = ({ tasks, meta, filters, selectedTask, busy, onFiltersChange, onPageChange, onSelect, onEngage, onComplete }) => {
  const pages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 25)));
  const page = Math.floor((meta.offset || 0) / (meta.limit || 25)) + 1;
  return (
    <div className="admin-finance-panel">
      <div className="admin-page-header"><h1>Paiements & <span>remboursements</span></h1></div>
      <form className="admin-card admin-finance-filters" onSubmit={(event) => { event.preventDefault(); onFiltersChange(Object.fromEntries(new FormData(event.currentTarget))); }}>
        <div><label htmlFor="finance-status">Statut</label><select id="finance-status" name="status" className="form-input" defaultValue={filters.status || ''}><option value="">Tous</option>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div><label htmlFor="finance-reference">Réservation</label><input id="finance-reference" name="reservationReference" className="form-input" defaultValue={filters.reservationReference || ''} placeholder="GSP-AAMMJJ-XXXX" /></div>
        <div><label htmlFor="finance-operator">Responsable</label><select id="finance-operator" name="operatorId" className="form-input" defaultValue={filters.operatorId || ''}><option value="">Tous</option>{(meta.operators || []).map((operator) => <option key={operator.id} value={operator.id}>{operator.name}</option>)}</select></div>
        <label className="admin-finance-overdue"><input name="overdue" type="checkbox" value="true" defaultChecked={filters.overdue === 'true' || filters.overdue === true} /> Échéance dépassée uniquement</label>
        <button type="submit" className="btn btn-primary">Filtrer</button>
      </form>
      <div className="admin-card">
        <div className="admin-finance-summary"><strong>{meta.total || 0} obligation(s)</strong><span>Page {page} / {pages}</span></div>
        {tasks.length === 0 ? <p className="admin-table-empty">Aucune obligation financière ne correspond aux filtres.</p> : (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Échéance</th><th>Réservation</th><th>Client</th><th>Montant</th><th>Statut</th><th>Responsable</th><th>Action</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className={selectedTask?.id === task.id ? 'admin-row-selected' : ''}><td>{formatBusinessDateTime(task.dueAt)}{isOverdue(task) && <small className="admin-overdue"><AlertTriangle size={13} /> En retard</small>}</td><td><code>{task.reservation.reference}</code></td><td>{clientName(task)}</td><td>{formatFcfa(task.amount)}</td><td><span className={'admin-pill pill-' + task.status.toLowerCase()}>{labels[task.status] || task.status}</span></td><td>{task.createdBy?.name || 'Système'}</td><td><button type="button" className="btn btn-primary admin-sm-btn" onClick={() => onSelect(task)}>Détails</button></td></tr>)}</tbody></table></div>
        )}
        <div className="admin-pagination"><button className="btn btn-secondary admin-sm-btn" type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(0, (meta.offset || 0) - (meta.limit || 25)))}>Précédent</button><button className="btn btn-secondary admin-sm-btn" type="button" disabled={page >= pages} onClick={() => onPageChange((meta.offset || 0) + (meta.limit || 25))}>Suivant</button></div>
      </div>
      {selectedTask && <section className="admin-card admin-finance-detail" tabIndex="-1" autoFocus data-financial-task={selectedTask.id}>
        <div className="admin-finance-detail-heading"><div><h2>Obligation {selectedTask.type === 'FULL_REFUND' ? 'de remboursement intégral' : 'de remboursement partiel'}</h2><p><code>{selectedTask.dedupeKey}</code></p></div>{selectedTask.status === 'COMPLETED' ? <CheckCircle2 aria-hidden="true" /> : <WalletCards aria-hidden="true" />}</div>
        <dl className="admin-finance-grid"><div><dt>Réservation</dt><dd><Link to={'/admin/reservations/' + selectedTask.reservation.reference}>{selectedTask.reservation.reference} <ExternalLink size={13} /></Link></dd></div><div><dt>Paiement</dt><dd>{paymentMethodLabel(selectedTask.payment.method)} · version {selectedTask.payment.version}</dd></div><div><dt>Montant</dt><dd>{formatFcfa(selectedTask.amount)}</dd></div><div><dt>Motif</dt><dd>{selectedTask.reason}</dd></div><div><dt>Échéance</dt><dd>{formatBusinessDateTime(selectedTask.dueAt)}</dd></div><div><dt>Responsable</dt><dd>{selectedTask.createdBy?.name || 'Création système'}</dd></div><div><dt>Canal</dt><dd>{selectedTask.channel || 'À définir lors de l’engagement'}</dd></div><div><dt>Référence opérateur</dt><dd>{selectedTask.providerReference || 'À enregistrer'}</dd></div><div><dt>Créée</dt><dd>{formatBusinessDateTime(selectedTask.createdAt)}</dd></div><div><dt>Engagée</dt><dd>{selectedTask.initiatedAt ? formatBusinessDateTime(selectedTask.initiatedAt) : '—'}</dd></div><div><dt>Terminée</dt><dd>{selectedTask.completedAt ? formatBusinessDateTime(selectedTask.completedAt) : '—'}</dd></div></dl>
        {selectedTask.proof && <div className="admin-finance-proof"><h3>Preuve immuable</h3><p>Canal : {selectedTask.proof.channel}</p><p>Référence : {selectedTask.proof.providerReference}</p><p>Enregistrée : {formatBusinessDateTime(selectedTask.proof.recordedAt)}</p></div>}
        <div className="admin-action-row">{selectedTask.status === 'PENDING' && <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onEngage(selectedTask)}><Clock3 size={16} /> Engager le remboursement</button>}{selectedTask.status === 'IN_PROGRESS' && <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onComplete(selectedTask)}><CheckCircle2 size={16} /> Finaliser avec preuve</button>}</div>
      </section>}
    </div>
  );
};

const DEFAULT_FILTERS = { limit: 25, offset: 0 };

const AdminFinancePanel = ({ destinationId, busy, openActionDialog, runAction, setFeedback }) => {
  const filtersRef = useRef(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: 25, offset: 0, operators: [] });
  const [selectedTask, setSelectedTask] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await getAdminFinancialTasks(filtersRef.current);
      setTasks(result.items);
      setMeta(result.meta);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Impossible de charger les obligations financières.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!destinationId) return;
    void getAdminFinancialTask(destinationId).then((task) => {
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      setSelectedTask(task);
      setError('');
      setFeedback(null);
      window.requestAnimationFrame(() => document.querySelector('[data-financial-task="' + task.id + '"]')?.focus());
    }).catch((destinationError) => {
      const message = destinationError.message || 'Obligation financière introuvable ou obsolète.';
      setError(message);
      setFeedback({ tab: 'finance', type: 'error', message });
    });
  }, [destinationId, setFeedback]);

  const applyFilters = async (values) => {
    const next = { limit: 25, offset: 0, status: values.status || undefined, reservationReference: values.reservationReference?.trim().toUpperCase() || undefined, operatorId: values.operatorId || undefined, overdue: values.overdue === 'true' };
    filtersRef.current = next;
    setFilters(next);
    await load();
  };
  const changePage = async (offset) => {
    const next = { ...filtersRef.current, offset };
    filtersRef.current = next;
    setFilters(next);
    await load();
  };
  const selectTask = async (task) => {
    const detail = await getAdminFinancialTask(task.id);
    setSelectedTask(detail);
    window.requestAnimationFrame(() => document.querySelector('[data-financial-task="' + task.id + '"]')?.focus());
  };
  const decide = (task, status) => {
    const completing = status === 'REFUNDED';
    openActionDialog({
      title: completing ? 'Finaliser le remboursement' : 'Engager le remboursement',
      summary: task.reservation.reference + ' · ' + formatFcfa(task.amount),
      consequence: completing ? 'La preuve opérateur sera figée, le paiement passera à remboursé et E-21 sera mise en file une seule fois.' : 'Le paiement passera à remboursement en cours et E-20 sera mise en file une seule fois.',
      confirmLabel: completing ? 'Finaliser avec preuve' : 'Engager',
      fields: [
        { name: 'channel', label: 'Canal de remboursement', required: true, defaultValue: task.channel || '' },
        { name: 'providerReference', label: completing ? 'Référence opérateur finale' : 'Référence opérateur de suivi', required: true, defaultValue: task.providerReference || '' },
        { name: 'reason', label: 'Motif opérationnel', type: 'textarea', required: true, defaultValue: completing ? 'Preuve opérateur vérifiée' : 'Remboursement engagé auprès de l’opérateur' },
      ],
      onConfirm: async (values) => {
        const success = await runAction(completing ? 'Finalisation du remboursement' : 'Engagement du remboursement', () => refundAdminPayment(task.payment.id, {
          commandId: window.crypto.randomUUID(), expectedVersion: task.payment.version, status, refundAmount: task.amount,
          channel: values.channel.trim(), providerReference: values.providerReference.trim(), reason: values.reason.trim(),
        }), true);
        if (success) {
          setSelectedTask(await getAdminFinancialTask(task.id));
          await load();
        }
      },
    });
  };

  return <>{error && <div className="admin-feedback error" role="alert">{error}</div>}<AdminFinanceView tasks={tasks} meta={meta} filters={filters} selectedTask={selectedTask} busy={busy} onFiltersChange={applyFilters} onPageChange={changePage} onSelect={selectTask} onEngage={(task) => decide(task, 'REFUND_PENDING')} onComplete={(task) => decide(task, 'REFUNDED')} /></>;
};

export default AdminFinancePanel;
