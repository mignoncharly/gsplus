import React from 'react';

import AdminDeliveriesPanel from './AdminDeliveriesPanel';
import AdminRescheduleRequestsPanel from './AdminRescheduleRequestsPanel';

const AdminReservationOperationsPanel = ({
  reservation,
  dateTime,
  pill,
  busy,
  ownerDisabled,
  onPublished,
  onDecision,
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
  </>
);

export default AdminReservationOperationsPanel;
