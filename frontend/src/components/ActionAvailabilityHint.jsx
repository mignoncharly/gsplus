import { useLocale } from '../lib/i18n.js';

const ActionAvailabilityHint = ({ id, message }) => {
  const { locale } = useLocale();
  if (!message) return null;
  return <p id={id} className="action-availability-hint"><span className="action-availability-hint__icon" aria-hidden="true">i</span><span><strong>{locale === 'en' ? 'Action unavailable:' : 'Action indisponible :'}</strong> {message}</span></p>;
};

export default ActionAvailabilityHint;
