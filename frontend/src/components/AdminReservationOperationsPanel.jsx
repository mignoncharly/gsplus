import React from 'react';

import AdminDeliveriesPanel from './AdminDeliveriesPanel';
import AdminRescheduleRequestsPanel from './AdminRescheduleRequestsPanel';
import AdminWithdrawalRequestsPanel from './AdminWithdrawalRequestsPanel';

const AdminReservationOperationsPanel = ({
  reservation,
  dateTime,
  pill,
  busy,
  ownerDisabled,
  onPublished,
  onDecision,
  onWithdrawalDecision,
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
  </>
);

export default AdminReservationOperationsPanel;
