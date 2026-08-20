import React from 'react';
import { useLocale } from '../lib/i18n.js';

const cardStyle = { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.88rem', color: 'rgba(255,255,255,0.85)', background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' };
const checkboxStyle = { marginTop: '0.15rem', accentColor: 'var(--c-gold)' };
const linkStyle = { color: 'var(--c-gold-light)', textDecoration: 'underline' };

const ReservationConsentFields = ({ formData, setFormData, fieldErrors, clearFieldError }) => {
  const { locale } = useLocale();
  const copy = locale === 'en' ? {
    legal: 'Before booking, please also read the', legalLink: 'Legal notice', promo: 'I authorise the use of images from the session for promotional purposes.', promoRequired: '* This agreement is required to benefit from this preferential rate.', standard: 'I authorise the use of images from the session for promotional purposes.', whatsapp: 'I agree to receive information related to my booking on WhatsApp.', marketing: 'I agree to occasionally receive offers, news and promotional communications from Golden Studio Plus on WhatsApp. I may withdraw my consent at any time.', privacyPrefix: 'I acknowledge that I have read the', privacyLink: 'Privacy Policy', termsJoin: 'and accept the', termsLink: 'Terms of Sale',
  } : {
    legal: 'Avant de réserver, consultez aussi les', legalLink: 'Mentions légales', promo: 'J’autorise l’utilisation des images de la séance à des fins promotionnelles.', promoRequired: '* Cette acceptation est obligatoire pour bénéficier de ce tarif préférentiel.', standard: 'J’autorise l’utilisation des images de la séance à des fins promotionnelles.', whatsapp: 'J’accepte de recevoir les informations liées à ma réservation sur WhatsApp.', marketing: 'J’accepte de recevoir occasionnellement sur WhatsApp les offres, actualités et communications promotionnelles de Golden Studio Plus. Je peux retirer mon consentement à tout moment.', privacyPrefix: 'Je reconnais avoir pris connaissance de la', privacyLink: 'Politique de confidentialité', termsJoin: 'et j’accepte les', termsLink: 'Conditions générales de vente',
  };
  const legalError = fieldErrors.acceptedTerms || fieldErrors.acceptedPrivacy;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
    <p style={{ ...cardStyle, cursor: 'default', margin: 0 }}><span>{copy.legal} <a href="/mentions-legales" target="_blank" rel="noreferrer" style={linkStyle}>{copy.legalLink}</a>.</span></p>
    <label style={cardStyle}><input id="booking-image-consent" name="consentImage" type="checkbox" checked={formData.consent} onChange={e => { setFormData({ ...formData, consent: e.target.checked }); clearFieldError('consentImage'); }} aria-invalid={Boolean(fieldErrors.consentImage)} aria-describedby={fieldErrors.consentImage ? 'booking-image-consent-error' : undefined} style={checkboxStyle} />{formData.isPromo ? <span>{copy.promo}<br /><strong style={{ color: 'var(--c-gold-light)' }}>{copy.promoRequired}</strong></span> : <span>{copy.standard}</span>}</label>
    {fieldErrors.consentImage && <p id="booking-image-consent-error" className="form-field-error" role="alert">{fieldErrors.consentImage}</p>}
    <label style={cardStyle}><input id="booking-whatsapp-consent" name="whatsappConsent" type="checkbox" checked={formData.whatsappConsent} onChange={e => setFormData({ ...formData, whatsappConsent: e.target.checked })} style={checkboxStyle} /><span>{copy.whatsapp}</span></label>
    <label style={cardStyle}><input id="booking-whatsapp-marketing-consent" name="whatsappMarketingConsent" type="checkbox" checked={formData.whatsappMarketingConsent} onChange={e => setFormData({ ...formData, whatsappMarketingConsent: e.target.checked })} style={checkboxStyle} /><span>{copy.marketing}</span></label>
    <label style={cardStyle}><input id="booking-legal-acceptance" name="acceptedTerms" type="checkbox" checked={formData.acceptCGV && formData.acceptPrivacy} required onChange={e => { setFormData({ ...formData, acceptCGV: e.target.checked, acceptPrivacy: e.target.checked }); clearFieldError('acceptedTerms'); clearFieldError('acceptedPrivacy'); }} aria-invalid={Boolean(legalError)} aria-describedby={legalError ? 'booking-legal-acceptance-error' : undefined} style={checkboxStyle} /><span>{copy.privacyPrefix} <a href="/confidentialite" target="_blank" rel="noreferrer" style={linkStyle}>{copy.privacyLink}</a> {copy.termsJoin} <a href="/cgv" target="_blank" rel="noreferrer" style={linkStyle}>{copy.termsLink}</a>. *</span></label>
    {legalError && <p id="booking-legal-acceptance-error" className="form-field-error" role="alert">{legalError}</p>}
  </div>;
};

export default ReservationConsentFields;
