import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Copy, Download, Search } from 'lucide-react';

import {
  adminExportUrl,
  getAdminPaymentDuplicates,
  getAdminPayments,
  linkAdminPaymentDuplicate,
  recordAdminPaymentDeclaredAmount,
} from '../lib/api';
import { formatBusinessDateTime } from '../lib/business-time';
import { formatFcfa } from '../lib/display-formatters';
import { paymentMethodLabel, statusLabel } from '../lib/status-labels';

// The report's payment vocabulary, in its order. Refund states belong to the refunds
// sub-view and are deliberately absent here.
const VERIFICATION_STATUSES = [
  'PENDING',
  'PAYMENT_INFO_REQUIRED',
  'VERIFICATION_BLOCKED',
  'VERIFIED',
  'REJECTED',
];

const DEFAULT_FILTERS = { limit: 25, offset: 0, open: true };

const pill = (status) => <span className={`admin-pill pill-${String(status).toLowerCase()}`}>{statusLabel(status)}</span>;

const clientName = (payment) => {
  const snapshot = payment.reservation?.snapshot;
  const customer = payment.reservation?.customer;
  const source = snapshot ?? customer;
  return source ? `${source.firstName} ${source.lastName}` : 'Client inconnu';
};

const ageInDays = (value) => Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);

const AdminPaymentVerificationPanel = ({ busy, openActionDialog, runAction, setFeedback }) => {
  const filtersRef = useRef(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, limit: 25, offset: 0 });
  const [duplicates, setDuplicates] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await getAdminPayments(filtersRef.current);
      setItems(result.items);
      setMeta(result.meta);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Impossible de charger la file de vérification.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const apply = async (next) => {
    filtersRef.current = { ...next, limit: 25, offset: 0 };
    setFilters(filtersRef.current);
    await load();
  };

  const changePage = async (offset) => {
    filtersRef.current = { ...filtersRef.current, offset };
    setFilters(filtersRef.current);
    await load();
  };

  const inspectDuplicates = async (payment) => {
    try {
      const candidates = await getAdminPaymentDuplicates(payment.id);
      setDuplicates((current) => ({ ...current, [payment.id]: candidates }));
      if (candidates.length === 0) {
        setFeedback({ tab: 'finance', type: 'success', message: 'Aucun doublon probable pour ce paiement.' });
      }
    } catch (duplicateError) {
      setFeedback({ tab: 'finance', type: 'error', message: duplicateError.message || 'Recherche de doublons impossible.' });
    }
  };

  const recordDeclaredAmount = (payment) => openActionDialog({
    title: 'Enregistrer le montant reçu',
    summary: `${payment.reservation?.reference} · attendu ${formatFcfa(payment.amount)}`,
    consequence: 'Le montant est enregistré tel qu’il apparaît sur le relevé opérateur. Il ne modifie pas l’état du paiement.',
    confirmLabel: 'Enregistrer le montant',
    fields: [
      {
        name: 'declaredAmount', label: 'Montant réellement reçu (FCFA)', type: 'number', required: true, min: '0',
        defaultValue: payment.declaredAmount === null || payment.declaredAmount === undefined ? '' : String(payment.declaredAmount),
        validate: (value) => Number.isInteger(Number(value)) && Number(value) >= 0 ? '' : 'Indiquez un montant entier positif ou nul.',
      },
      { name: 'reason', label: 'Source du constat', type: 'textarea', required: true, defaultValue: 'Relevé opérateur vérifié' },
    ],
    onConfirm: async (values) => {
      const success = await runAction('Enregistrement du montant reçu', () => recordAdminPaymentDeclaredAmount(payment.id, {
        commandId: window.crypto.randomUUID(),
        expectedVersion: payment.version,
        declaredAmount: Number(values.declaredAmount),
        reason: values.reason.trim(),
      }), true);
      if (success) await load();
    },
  });

  const markDuplicate = (payment, candidate) => openActionDialog({
    title: 'Marquer comme doublon',
    summary: `${payment.reservation?.reference} · ${payment.transactionRef || 'sans code'}`,
    consequence: `Ce paiement sera présenté comme un doublon de ${candidate.reservation?.reference ?? candidate.id}. Aucun état de paiement n’est modifié.`,
    confirmLabel: 'Marquer le doublon',
    fields: [{ name: 'reason', label: 'Motif', type: 'textarea', required: true, defaultValue: 'Même transfert enregistré deux fois.' }],
    onConfirm: async (values) => {
      const success = await runAction('Marquage de doublon', () => linkAdminPaymentDuplicate(payment.id, {
        duplicateOfPaymentId: candidate.id, reason: values.reason.trim(),
      }), true);
      if (success) await load();
    },
  });

  const pages = Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 25)));
  const page = Math.floor((meta.offset || 0) / (meta.limit || 25)) + 1;

  return (
    <>
      {error && <div className="admin-feedback error" role="alert">{error}</div>}

      <form
        // Re-keyed on the applied filters so the controls always show the state that
        // is actually in force, including when a search clears the open-only filter.
        key={JSON.stringify(filters)}
        className="admin-card admin-finance-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget));
          const q = values.q?.trim() || undefined;
          void apply({
            q,
            status: values.status || undefined,
            method: values.method || undefined,
            // Looking for a specific payment searches the whole history. Keeping the
            // open-only restriction would silently hide any payment already decided,
            // and the report requires every payment to remain retrievable.
            open: q ? undefined : (values.open === 'true' ? true : undefined),
            mismatch: values.mismatch === 'true' ? true : undefined,
            duplicate: values.duplicate === 'true' ? true : undefined,
          });
        }}
      >
        <div className="admin-payment-search">
          <label htmlFor="payment-search">Rechercher</label>
          <input id="payment-search" name="q" className="form-input" type="search" defaultValue={filters.q || ''}
            placeholder="Code de transaction, téléphone, référence ou nom" />
          <small className="admin-record-hint">Une recherche porte sur l’historique complet, décisions comprises.</small>
        </div>
        <div>
          <label htmlFor="payment-status">Statut</label>
          <select id="payment-status" name="status" className="form-input" defaultValue={filters.status || ''}>
            <option value="">Tous</option>
            {VERIFICATION_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="payment-method">Opérateur</label>
          <select id="payment-method" name="method" className="form-input" defaultValue={filters.method || ''}>
            <option value="">Tous</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="orange_money">Orange Money</option>
          </select>
        </div>
        <label className="admin-finance-overdue">
          <input name="open" type="checkbox" value="true" defaultChecked={filters.open === true} /> À décider uniquement
        </label>
        <label className="admin-finance-overdue">
          <input name="mismatch" type="checkbox" value="true" defaultChecked={filters.mismatch === true} /> Écart de montant
        </label>
        <label className="admin-finance-overdue">
          <input name="duplicate" type="checkbox" value="true" defaultChecked={filters.duplicate === true} /> Doublons signalés
        </label>
        <button type="submit" className="btn btn-primary"><Search size={15} /> Filtrer</button>
      </form>

      <div className="admin-card">
        <div className="admin-finance-summary">
          <strong>{meta.total || 0} paiement(s)</strong>
          <span>Page {page} / {pages}</span>
          <a className="btn btn-secondary admin-sm-btn" href={adminExportUrl('payments', filters)}>
            <Download size={14} /> Exporter en CSV
          </a>
        </div>

        {items.length === 0 ? <p className="admin-table-empty">Aucun paiement ne correspond aux filtres.</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Réservation</th><th>Client</th><th>Opérateur</th><th>Code</th>
                  <th>Attendu / reçu</th><th>Paiement</th><th>Réservation</th><th>Âge</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((payment) => {
                  const candidates = duplicates[payment.id];
                  const flagged = Boolean(payment.duplicateOf) || (payment.duplicates?.length ?? 0) > 0;
                  return (
                    <tr key={payment.id} className={payment.amountVariance ? 'admin-row-attention' : ''}>
                      <td>
                        <Link to={`/admin/reservations/${payment.reservation?.reference}`}>
                          <code className="admin-public-reference">{payment.reservation?.reference}</code>
                        </Link>
                      </td>
                      <td>{clientName(payment)}<small>{payment.paymentPhone || '—'}</small></td>
                      <td>{paymentMethodLabel(payment.method)}</td>
                      <td><code>{payment.transactionRef || '—'}</code>
                        {flagged && <small className="admin-record-error"><Copy size={12} /> Doublon signalé</small>}
                      </td>
                      <td>
                        {formatFcfa(payment.amount)}
                        <small>
                          {payment.declaredAmount === null || payment.declaredAmount === undefined
                            ? 'Reçu : non renseigné'
                            : `Reçu : ${formatFcfa(payment.declaredAmount)}`}
                        </small>
                        {payment.amountVariance !== null && payment.amountVariance !== 0 && (
                          <small className="admin-record-error">
                            <AlertTriangle size={12} /> Écart {payment.amountVariance > 0 ? '+' : ''}{formatFcfa(payment.amountVariance)}
                          </small>
                        )}
                      </td>
                      <td>{pill(payment.status)}</td>
                      <td>{pill(payment.reservation?.status)}</td>
                      <td>{ageInDays(payment.createdAt)} j<small>{formatBusinessDateTime(payment.createdAt)}</small></td>
                      <td>
                        <div className="admin-action-row">
                          <button type="button" className="btn btn-secondary admin-sm-btn" disabled={busy}
                            onClick={() => recordDeclaredAmount(payment)}>Montant reçu</button>
                          <button type="button" className="btn btn-secondary admin-sm-btn"
                            onClick={() => inspectDuplicates(payment)}>Doublons</button>
                          <Link className="btn btn-primary admin-sm-btn" to={`/admin/reservations/${payment.reservation?.reference}`}>
                            Décider
                          </Link>
                        </div>
                        {candidates?.length > 0 && (
                          <ul className="admin-payment-duplicates">
                            {candidates.map((candidate) => (
                              <li key={candidate.id}>
                                <span>{candidate.reservation?.reference} · {candidate.transactionRef || 'sans code'} · {statusLabel(candidate.status)}</span>
                                <button type="button" className="btn btn-secondary admin-sm-btn" disabled={busy}
                                  onClick={() => markDuplicate(payment, candidate)}>Marquer doublon</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination">
          <button className="btn btn-secondary admin-sm-btn" type="button" disabled={page <= 1}
            onClick={() => changePage(Math.max(0, (meta.offset || 0) - (meta.limit || 25)))}>Précédent</button>
          <button className="btn btn-secondary admin-sm-btn" type="button" disabled={page >= pages}
            onClick={() => changePage((meta.offset || 0) + (meta.limit || 25))}>Suivant</button>
        </div>
      </div>
    </>
  );
};

export default AdminPaymentVerificationPanel;
