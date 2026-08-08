import React from 'react';

const cardStyle = { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' };
const checkboxStyle = { marginTop: '0.15rem', accentColor: 'var(--c-gold)' };
const linkStyle = { color: 'var(--c-gold-light)', textDecoration: 'underline' };

const ReservationConsentFields = ({ formData, setFormData, fieldErrors, clearFieldError }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
    <label style={cardStyle}>
      <input id="booking-image-consent" name="consentImage" type="checkbox" checked={formData.consent} onChange={e => { setFormData({...formData, consent: e.target.checked}); clearFieldError('consentImage'); }} aria-invalid={Boolean(fieldErrors.consentImage)} aria-describedby={fieldErrors.consentImage ? 'booking-image-consent-error' : undefined} style={checkboxStyle} />
      {formData.isPromo ? <span>
        J'accepte expressément l’utilisation de certaines images de la séance. Finalité : Portfolio et promotion du Studio. Portée : Site web, Instagram et TikTok. <br />
        <strong style={{ color: 'var(--c-gold-light)' }}>* Cette acceptation est obligatoire pour bénéficier de ce tarif préférentiel.</strong>
      </span> : <span>
        J'autorise Golden Studio Plus à utiliser certaines images de la séance. Finalité : Portfolio et promotion du Studio. Portée : Site web, Instagram et TikTok. Choix facultatif et révocable pour l’avenir.
      </span>}
    </label>
    {fieldErrors.consentImage && <p id="booking-image-consent-error" className="form-field-error" role="alert">{fieldErrors.consentImage}</p>}

    <label style={cardStyle}>
      <input id="booking-whatsapp-consent" name="whatsappConsent" type="checkbox" checked={formData.whatsappConsent} onChange={e => setFormData({...formData, whatsappConsent: e.target.checked})} style={checkboxStyle} />
      <span>J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette réservation (réception, confirmation, modification ou paiement). Optionnel.</span>
    </label>

    <label style={cardStyle}>
      <input id="booking-terms" name="acceptedTerms" type="checkbox" checked={formData.acceptCGV} required onChange={e => { setFormData({...formData, acceptCGV: e.target.checked}); clearFieldError('acceptedTerms'); }} aria-invalid={Boolean(fieldErrors.acceptedTerms)} aria-describedby={fieldErrors.acceptedTerms ? 'booking-terms-error' : undefined} style={checkboxStyle} />
      <span>J'accepte les <a href="/cgv" target="_blank" style={linkStyle}>Conditions Générales de Vente (CGV)</a>. *</span>
    </label>
    {fieldErrors.acceptedTerms && <p id="booking-terms-error" className="form-field-error" role="alert">{fieldErrors.acceptedTerms}</p>}

    <label style={cardStyle}>
      <input id="booking-privacy" name="acceptedPrivacy" type="checkbox" checked={formData.acceptPrivacy} required onChange={e => { setFormData({...formData, acceptPrivacy: e.target.checked}); clearFieldError('acceptedPrivacy'); }} aria-invalid={Boolean(fieldErrors.acceptedPrivacy)} aria-describedby={fieldErrors.acceptedPrivacy ? 'booking-privacy-error' : undefined} style={checkboxStyle} />
      <span>Je confirme avoir lu la <a href="/confidentialite" target="_blank" style={linkStyle}>Politique de Confidentialité</a>. *</span>
    </label>
    {fieldErrors.acceptedPrivacy && <p id="booking-privacy-error" className="form-field-error" role="alert">{fieldErrors.acceptedPrivacy}</p>}
  </div>
);

export default ReservationConsentFields;
