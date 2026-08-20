import React, { useId } from 'react';

const TransactionalWhatsAppConsent = ({
  id,
  label,
  help,
  errorId,
  defaultChecked = false,
  checked,
  onChange,
  className = '',
}) => {
  const generatedId = useId();
  const inputId = id || `whatsapp-consent-${generatedId}`;
  const helpId = help ? `${inputId}-help` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`transactional-whatsapp-consent ${className}`.trim()}>
      <label htmlFor={inputId} className="transactional-whatsapp-consent__label">
        <input
          id={inputId}
          name="whatsappConsent"
          type="checkbox"
          defaultChecked={checked === undefined ? defaultChecked : undefined}
          checked={checked}
          onChange={onChange}
          aria-describedby={describedBy}
        />
        <span>{label}</span>
      </label>
      {help && <p id={helpId} className="transactional-whatsapp-consent__help">{help}</p>}
    </div>
  );
};

export default TransactionalWhatsAppConsent;
