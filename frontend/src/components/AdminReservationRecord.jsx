import React from 'react';
import { CalendarClock, Mail, MessageCircle } from 'lucide-react';

import { formatBusinessDateTime } from '../lib/business-time';
import { formatFcfa } from '../lib/display-formatters';
import {
  calendarErrorLabel,
  isTemporalOverrideTransition,
  paymentMethodLabel,
  statusLabel,
  transitionActorLabel,
} from '../lib/admin-workflow';
import { NOTIFICATION_AUDIENCE_LABELS, notificationTypeDescriptor } from '../lib/status-labels';

const AdminWhatsAppPanel = React.lazy(() => import('./AdminWhatsAppPanel'));
const AdminOpsPanel = React.lazy(() => import('./AdminReservationOperationsPanel'));

const dateTime = formatBusinessDateTime;
const pill = (status) => <span className={`admin-pill pill-${String(status).toLowerCase()}`}>{statusLabel(status)}</span>;
const latestCalendarSync = (reservation) => reservation?.calendarSync || reservation?.calendarSyncLogs?.[0] || null;

const durationLabel = (reservation) => {
  const minutes = reservation?.snapshot?.durationMin
    ?? (reservation?.startAt && reservation?.endAt
      ? Math.round((new Date(reservation.endAt) - new Date(reservation.startAt)) / 60000)
      : null);
  if (!Number.isFinite(minutes)) return '—';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest}` : `${hours} h`;
};

/** Frozen at booking time; the live customer row may since have been edited. */
const frozenContact = (reservation) => {
  const snapshot = reservation?.snapshot;
  if (!snapshot) return null;
  return {
    name: `${snapshot.firstName} ${snapshot.lastName}`,
    phone: snapshot.notificationPhoneE164 ?? snapshot.phoneE164,
    email: snapshot.notificationEmail ?? snapshot.email ?? '',
    locale: snapshot.locale,
    whatsappConsent: snapshot.whatsappConsent,
    whatsappConsentAt: snapshot.whatsappConsentAt,
    marketingConsent: snapshot.whatsappMarketingConsent,
    expectedAmount: snapshot.amount,
  };
};

const Field = ({ label, children }) => (
  <div className="admin-record-field"><dt>{label}</dt><dd>{children}</dd></div>
);

/**
 * One timeline for everything the customer or an external provider saw: e-mails,
 * WhatsApp messages and calendar synchronisations, newest first, so an operator can
 * answer "what has this person actually received?" without reading three panels.
 */
const chronologyEntries = (reservation) => {
  const messages = (reservation?.notifications ?? []).map((item) => {
    const descriptor = notificationTypeDescriptor(item.type);
    return {
      key: `notification:${item.id}`,
      at: item.createdAt,
      icon: item.channel === 'whatsapp' ? MessageCircle : Mail,
      channel: item.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail',
      title: descriptor.name,
      audience: descriptor.audience,
      status: item.status,
      recipient: item.recipient,
      detail: item.templateCode
        ? `Modèle ${item.templateCode}${item.templateVersion ? ` · v${item.templateVersion}` : ''}`
        : '',
      error: item.error,
      retryable: item.status === 'FAILED',
      notification: item,
    };
  });

  const calendar = (reservation?.calendarSyncLogs ?? []).map((log) => ({
    key: `calendar:${log.id}`,
    at: log.createdAt,
    icon: CalendarClock,
    channel: log.provider || 'Cal.com',
    title: `Synchronisation calendrier — ${log.action || 'action inconnue'}`,
    audience: null,
    status: log.status,
    recipient: log.externalEventId ? `Événement ${log.externalEventId}` : '',
    detail: `Tentative ${log.attemptCount || 0}`,
    error: log.error ? calendarErrorLabel(log.error) : '',
    retryable: false,
  }));

  return [...messages, ...calendar].sort((a, b) => new Date(b.at) - new Date(a.at));
};

const TransitionEntry = ({ transition }) => (
  <li>
    <div className="admin-record-transition-heads">
      {pill(transition.fromStatus)} <span aria-hidden="true">→</span> {pill(transition.toStatus)}
    </div>
    <small>{transitionActorLabel(transition)} · {dateTime(transition.createdAt)}</small>
    {transition.oldStartAt && transition.newStartAt && transition.oldStartAt !== transition.newStartAt && (
      <small>Créneau : {dateTime(transition.oldStartAt)} → {dateTime(transition.newStartAt)}</small>
    )}
    {isTemporalOverrideTransition(transition) && (
      <small className="admin-temporal-override">Dérogation temporelle — clôture avant la fin programmée</small>
    )}
    {/* The two vocabularies are kept apart on purpose: one is operational, the other left the studio. */}
    {(transition.internalReason || transition.reason) && (
      <small className="admin-record-note admin-record-note--internal">
        <strong>Note interne :</strong> {transition.internalReason || transition.reason}
      </small>
    )}
    {(transition.customerReasonText || transition.customerReasonCode) && (
      <small className="admin-record-note admin-record-note--customer">
        <strong>Communiqué au client :</strong> {transition.customerReasonText || transition.customerReasonCode}
        {transition.customerLocale ? ` (${transition.customerLocale.toUpperCase()})` : ''}
      </small>
    )}
  </li>
);

const AdminReservationRecord = ({
  reservation,
  payment,
  busy,
  ownerDisabled,
  endReached,
  busyActions,
  actions,
}) => {
  const snapshot = frozenContact(reservation);
  const calendar = latestCalendarSync(reservation);
  const chronology = chronologyEntries(reservation);
  const declaredAmount = payment?.amount ?? null;
  const expectedAmount = snapshot?.expectedAmount ?? reservation?.package?.price ?? null;
  const amountMismatch = Number.isFinite(declaredAmount) && Number.isFinite(expectedAmount) && declaredAmount !== expectedAmount;

  return (
    <>
      <header className="admin-record-header">
        <div>
          <p className="admin-record-eyebrow">Dossier de réservation</p>
          <h2>Réservation <span>{reservation.reference}</span></h2>
          <p className="admin-record-subject">
            {snapshot?.name ?? `${reservation.customer?.firstName ?? ''} ${reservation.customer?.lastName ?? ''}`.trim()}
            {' · '}{reservation.package?.name}
          </p>
        </div>
        <dl className="admin-record-header-facts">
          <Field label="Séance (Douala)">{dateTime(reservation.startAt)}</Field>
          <Field label="Durée">{durationLabel(reservation)}</Field>
          <Field label="État général">{pill(reservation.status)}</Field>
        </dl>
      </header>

      {reservation.scheduleKind === 'CUSTOM_PROPOSAL' && (
        <div className="admin-modal-block" role="status">
          <strong>Proposition d’horaire — non bloquante et non confirmée</strong>
          <p>Demandée pour {dateTime(reservation.requestedStartAt || reservation.startAt)} — {dateTime(reservation.requestedEndAt || reservation.endAt)} ({reservation.requestedTimeZone || 'Africa/Douala'}). La confirmation relancera tous les contrôles de disponibilité.</p>
        </div>
      )}

      {/* Two independent blocks, because a verified payment can sit on an undecided
          reservation and the studio must be able to read each state on its own. */}
      <div className="admin-record-columns">
        <section className="admin-record-block" aria-labelledby="record-reservation-heading">
          <h3 id="record-reservation-heading">Réservation</h3>
          <dl className="admin-record-fields">
            <Field label="Statut">{pill(reservation.status)}</Field>
            <Field label="Créneau">{dateTime(reservation.startAt)} — {dateTime(reservation.endAt)}</Field>
            <Field label="Formule">{reservation.package?.name} · {formatFcfa(reservation.package?.price)}</Field>
          </dl>
          <h4>Historique</h4>
          {reservation.transitions?.length > 0 ? (
            <ul className="admin-record-timeline">
              {reservation.transitions.map((transition) => <TransitionEntry key={transition.id} transition={transition} />)}
            </ul>
          ) : <p className="admin-record-empty">Aucun changement d’état enregistré.</p>}
        </section>

        <section className="admin-record-block" aria-labelledby="record-payment-heading">
          <h3 id="record-payment-heading">Paiement</h3>
          <dl className="admin-record-fields">
            <Field label="Statut">{payment ? pill(payment.status) : pill('AUCUN PAIEMENT')}</Field>
            {payment && <Field label="Opérateur">{paymentMethodLabel(payment.method)}</Field>}
            {payment && <Field label="Code de transaction">{payment.transactionRef || 'Non fournie'}</Field>}
            {payment && <Field label="Téléphone payeur">{payment.paymentPhone || 'Non spécifié'}</Field>}
            <Field label="Montant attendu">{Number.isFinite(expectedAmount) ? formatFcfa(expectedAmount) : '—'}</Field>
            {payment && (
              <Field label="Montant déclaré">
                {formatFcfa(declaredAmount)}
                {amountMismatch && <span className="admin-pill admin-pill--count admin-record-mismatch">Écart de montant</span>}
              </Field>
            )}
            {payment?.verifiedAt && <Field label="Vérifié le">{dateTime(payment.verifiedAt)}</Field>}
          </dl>
          <h4>Historique</h4>
          {payment?.transitions?.length > 0 ? (
            <ul className="admin-record-timeline">
              {payment.transitions.map((transition) => <TransitionEntry key={transition.id} transition={transition} />)}
            </ul>
          ) : <p className="admin-record-empty">Aucun changement d’état enregistré.</p>}
        </section>
      </div>

      <section className="admin-record-block" aria-labelledby="record-contact-heading">
        <h3 id="record-contact-heading">Coordonnées figées et consentements</h3>
        <p className="admin-record-hint">Enregistrées au moment de la réservation. Elles ne suivent pas les modifications ultérieures du profil client.</p>
        <dl className="admin-record-fields">
          <Field label="Client">{snapshot?.name ?? '—'}</Field>
          <Field label="Téléphone">{snapshot?.phone ?? '—'}</Field>
          <Field label="E-mail">{snapshot?.email || 'Non communiqué'}</Field>
          <Field label="Langue">{(snapshot?.locale ?? 'fr').toUpperCase()}</Field>
          {/* WhatsApp transactional consent is stated once, by AdminWhatsAppPanel below,
              which also owns the action it gates. Only the separate marketing consent
              is repeated here. */}
          <Field label="Consentement marketing">{snapshot?.marketingConsent ? 'Accordé' : 'Non accordé'}</Field>
        </dl>
        <React.Suspense fallback={<p className="admin-record-empty">Chargement du canal WhatsApp…</p>}>
          <AdminWhatsAppPanel reservation={reservation} />
        </React.Suspense>
        {reservation.extraInfo && (
          <>
            <h4>Notes additionnelles du client</h4>
            <p className="admin-record-customer-note">{reservation.extraInfo}</p>
          </>
        )}
      </section>

      <section className="admin-record-block" aria-labelledby="record-chronology-heading">
        <h3 id="record-chronology-heading">Chronologie des communications et du calendrier</h3>
        {calendar && (
          <p className="admin-record-hint">
            Dernière synchronisation {calendar.provider || 'Cal.com'} : {statusLabel(calendar.status)}
            {calendar.syncedAt ? ` · ${dateTime(calendar.syncedAt)}` : ''}
            {calendar.nextAttemptAt ? ` · prochaine tentative ${dateTime(calendar.nextAttemptAt)}` : ''}
          </p>
        )}
        {chronology.length === 0 ? (
          <p className="admin-record-empty">Aucun message ni événement calendrier enregistré.</p>
        ) : (
          <ul className="admin-record-chronology">
            {chronology.map((entry) => (
              <li key={entry.key}>
                <span className="admin-record-chronology-icon" aria-hidden="true">
                  {React.createElement(entry.icon, { size: 16 })}
                </span>
                <div>
                  <div className="admin-record-chronology-head">
                    <strong>{entry.title}</strong>
                    {entry.audience && (
                      <span className={`admin-pill admin-pill--audience audience-${entry.audience.toLowerCase()}`}>
                        {NOTIFICATION_AUDIENCE_LABELS[entry.audience]}
                      </span>
                    )}
                    {pill(entry.status)}
                  </div>
                  <small>{entry.channel} · {dateTime(entry.at)}{entry.recipient ? ` · ${entry.recipient}` : ''}</small>
                  {entry.detail && <small>{entry.detail}</small>}
                  {entry.error && <small className="admin-record-error">{entry.error}</small>}
                  {entry.retryable && actions.onRetryNotification && (
                    <button
                      type="button"
                      className="btn btn-secondary admin-sm-btn"
                      onClick={() => actions.onRetryNotification(entry.notification)}
                    >
                      Réessayer l’envoi
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <React.Suspense>
        <AdminOpsPanel
          reservation={reservation}
          dateTime={dateTime}
          pill={pill}
          busy={busy}
          ownerDisabled={ownerDisabled}
          onPublished={actions.onPublished}
          onDecision={actions.onRescheduleDecision}
          onWithdrawalDecision={actions.onWithdrawalDecision}
          onImageConsentRecord={actions.onImageConsentRecord}
        />
      </React.Suspense>

      <div className="admin-action-row admin-record-actions">
        {actions.renderActions({ reservation, payment, busy, ownerDisabled, endReached, busyActions })}
      </div>
    </>
  );
};

export default AdminReservationRecord;
