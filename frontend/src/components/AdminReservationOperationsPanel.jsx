import React from 'react';

import AdminDeliveriesPanel from './AdminDeliveriesPanel';
import AdminRescheduleRequestsPanel from './AdminRescheduleRequestsPanel';
import AdminWithdrawalRequestsPanel from './AdminWithdrawalRequestsPanel';
import AdminImageConsentPanel from './AdminImageConsentPanel';

const AdminReservationOperationsPanel = ({
  reservation,
  dateTime,
  pill,
  busy,
  ownerDisabled,
  onPublished,
  onDecision,
  onWithdrawalDecision,
  onImageConsentRecord,
}) => (
  <>
    <AdminDeliveriesPanel
      reservation={reservation}
      dateTime={dateTime}
      busy={busy}
      ownerDisabled={ownerDisabled}
      onPublished={onPublished}
    />
    <AdminRescheduleRequestsPanel
      requests={reservation.rescheduleRequests}
      dateTime={dateTime}
      pill={pill}
      busy={busy}
      ownerDisabled={ownerDisabled}
      onDecision={onDecision}
    />
    <AdminWithdrawalRequestsPanel
      requests={reservation.withdrawalRequests}
      dateTime={dateTime}
      pill={pill}
      busy={busy}
      ownerDisabled={ownerDisabled}
      onDecision={onWithdrawalDecision}
    />
    <AdminImageConsentPanel
      events={reservation.imageConsentEvents}
      dateTime={dateTime}
      busy={busy}
      ownerDisabled={ownerDisabled}
      onRecord={onImageConsentRecord}
    />
  </>
);

export default AdminReservationOperationsPanel;
