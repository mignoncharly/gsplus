const ActionAvailabilityHint = ({ id, message }) => message && (
  <p id={id} className="action-availability-hint">
    <span className="action-availability-hint__icon" aria-hidden="true">i</span>
    <span><strong>Action indisponible :</strong> {message}</span>
  </p>
);

export default ActionAvailabilityHint;
