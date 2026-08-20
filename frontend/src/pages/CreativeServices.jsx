import React, { useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Palette, PenTool, Image as ImageIcon, Shirt, Check, Send, AlertTriangle } from 'lucide-react';
import { submitQuoteRequest } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import { validationSummaryForApiError } from '../lib/form-errors';
import './CreativeServices.css';
import { useLocale } from '../lib/i18n.js';
import TransactionalWhatsAppConsent from '../components/TransactionalWhatsAppConsent';

const creativeServices = (locale) => locale === 'en' ? [
  { id: 1, title: 'Retouching & Restoration', desc: 'Restoration of old or altered photographs, advanced colour correction, cut-outs and removal of artistic imperfections.', icon: <ImageIcon size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'From 5,000 FCFA' },
  { id: 2, title: 'Flyer Design', desc: 'Premium commercial flyers, exceptional event posters, high-definition print formats or optimised digital formats.', icon: <PenTool size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'From 15,000 FCFA' },
  { id: 3, title: 'Visual Materials', desc: 'Art direction for large-format banners, premium roll-ups and display materials ready for fine-art printing.', icon: <Palette size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'Quote on request' },
  { id: 4, title: 'Personalised Products', desc: 'Elegant visual identities for mugs, T-shirts, premium cushions and prestigious corporate gifts.', icon: <Shirt size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'Quote on request' },
] : [
  { id: 1, title: 'Retouche & Restauration', desc: 'Restauration de clichés anciens ou altérés, correction colorimétrique avancée, détourage et gommage d’imperfections d’art.', icon: <ImageIcon size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'À partir de 5 000 FCFA' },
  { id: 2, title: 'Conception de Flyers', desc: 'Création de flyers commerciaux prestigieux, affiches événementielles d’exception, formats print haute définition ou digital optimisés.', icon: <PenTool size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'À partir de 15 000 FCFA' },
  { id: 3, title: 'Supports Visuels', desc: 'Design et direction artistique de bâches grand format, roll-ups haut de gamme et banderoles prêtes pour un tirage d’impression d’art.', icon: <Palette size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'Sur devis' },
  { id: 4, title: 'Objets Personnalisés', desc: 'Conception de chartes visuelles élégantes pour mugs, t-shirts, coussins haut de gamme ou cadeaux d’affaires corporatifs prestigieux.', icon: <Shirt size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, price: 'Sur devis' },
];

const cardTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

const CreativeServices = () => {
  const { locale } = useLocale();
  const t = (fr, en) => locale === 'en' ? en : fr;
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const submissionController = useRef(createLeadSubmissionController());

  const startAnotherRequest = () => {
    submissionController.current.next();
    setError('');
    setFieldErrors({});
    setSubmitted(false);
  };

  const clearFieldError = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const contactErrors = validateContactFields({
      phone: form.get('phone'),
      email: form.get('email'),
      phoneRequired: true,
      whatsappConsent: form.get('whatsappConsent') === 'on',
      locale,
    });
    setFieldErrors(contactErrors);
    if (Object.keys(contactErrors).length > 0) {
      setError(t('Corrigez les champs indiqués ci-dessous.', 'Please correct the fields highlighted below.'));
      return;
    }

    const submission = submissionController.current.start(formElement);
    if (!submission) return;
    setError('');
    setSubmitting(true);

    const service = form.get('service');
    const message = form.get('message');

    try {
      await submitQuoteRequest({
        submissionKey: submission.submissionKey,
        name: form.get('name'),
        phone: form.get('phone'),
        email: form.get('email') || undefined,
        whatsappConsent: form.get('whatsappConsent') === 'on',
        packageName: service ? `${t('Service créatif', 'Creative service')}: ${service}` : t('Service créatif', 'Creative service'),
        message: [service ? `${t('Service', 'Service')}: ${service}` : null, message || t('Demande de devis créatif.', 'Creative quote request.')]
          .filter(Boolean)
          .join('\n\n'),
        website: form.get('website') || '',
      });
      resetFormAfterSuccess(submission.formElement, true);
      setSubmitted(true);
    } catch (err) {
      submissionController.current.fail();
      const apiFields = validationErrorsFromApi(err, { name: 'name', phone: 'phone', email: 'email', packageName: 'service', message: 'message' }, locale);
      if (Object.keys(apiFields).length > 0) setFieldErrors((current) => ({ ...current, ...apiFields }));
      setError(validationSummaryForApiError(err, locale) || t("Impossible d’envoyer la demande. Veuillez réessayer.", 'Unable to send the request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="creative-services">
      <div className="container">
        
        {/* Page Header */}
        <Motion.div 
          className="text-center" 
          style={{ marginBottom: '4rem' }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="creative-services-title">{t('Services', 'Creative')} <span>{t('Créatifs', 'services')}</span> & Design</h1>
          <p className="creative-services-subtitle">
            {t("Bien plus qu’un studio photo. Nous accompagnons les professionnels exigeants et les particuliers dans la création de leurs supports de communication et produits d’art personnalisés.", 'More than a photo studio, we support discerning professionals and individuals in creating communication materials and personalised art products.')}
          </p>
        </Motion.div>

        {/* Services Cards Grid */}
        <div className="creative-services-grid">
          {creativeServices(locale).map((s, index) => (
            <Motion.div 
              key={s.id} 
              className="creative-service-card"
              variants={cardTransition}
              initial="initial"
              animate="animate"
              transition={{ delay: index * 0.1, duration: 0.5 }}
            >
              <div className="creative-service-icon-wrapper">
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className="creative-service-price">{s.price}</span>
              </div>
            </Motion.div>
          ))}
        </div>

        {/* Quote Form Card */}
        <Motion.div 
          id="devis-creatif"
          tabIndex="-1"
          className="creative-quote-card"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {submitted ? (
            <div className="quote-success-wrap" role="status" aria-live="polite">
              <div className="quote-success-seal">
                <Check size={36} />
              </div>
              <h3>{t('Demande envoyée !', 'Request sent!')}</h3>
              <p>
                {t('Nous avons bien reçu votre projet de design créatif. Nos directeurs de création étudient votre demande et vous recontacteront très rapidement sur WhatsApp ou par e-mail.', 'We have received your creative-design project. Our creative directors are reviewing your request and will contact you shortly via WhatsApp or email.')}
              </p>
              <button className="btn btn-secondary" onClick={startAnotherRequest}>
                {t('Faire une autre demande', 'Make another request')}
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-center" style={{ marginBottom: '0.5rem' }}>{t('Demander un', 'Request a')} <span>{t('Devis personnalisé', 'personalised quote')}</span></h2>
              <p className="text-center creative-quote-subtitle">
                {t('Présentez-nous votre projet en quelques lignes. Nos experts graphistes vous transmettront une proposition sur-mesure sous 24 h.', 'Tell us about your project in a few lines. Our graphic-design experts will send you a tailored proposal within 24 hours.')}
              </p>
              
              <form onSubmit={handleSubmit} aria-describedby={error ? 'creative-quote-error' : undefined} style={{ marginTop: '2rem' }}>
                {/* Honeypot field */}
                <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="creative-name" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Nom complet ou entreprise *', 'Full name or company *')}</label>
                    <input id="creative-name" autoComplete="name" name="name" type="text" placeholder={t('Ex. : Cabinet Alpha ou Eric M.', 'E.g. Alpha Firm or Eric M.')} required className="form-input" onChange={() => clearFieldError('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'creative-name-error' : undefined} />
                    {fieldErrors.name && <p id="creative-name-error" className="form-field-error" role="alert">{fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="creative-phone" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Téléphone / WhatsApp *', 'Phone / WhatsApp *')}</label>
                    <input id="creative-phone" autoComplete="tel" name="phone" type="tel" inputMode="tel" placeholder={t('Ex. : 640 70 32 49', 'E.g. 640 70 32 49')} required className="form-input" onChange={() => clearFieldError('phone')} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'creative-phone-error' : undefined} />
                    {fieldErrors.phone && <p id="creative-phone-error" className="form-field-error" role="alert">{fieldErrors.phone}</p>}
                  </div>
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="creative-email" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Adresse e-mail (optionnel)', 'Email address (optional)')}</label>
                  <input id="creative-email" autoComplete="email" name="email" type="email" inputMode="email" placeholder={t('Ex. : direction@entreprise.com', 'E.g. management@company.com')} className="form-input" onChange={() => clearFieldError('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'creative-email-error' : undefined} />
                  {fieldErrors.email && <p id="creative-email-error" className="form-field-error" role="alert">{fieldErrors.email}</p>}
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="creative-service" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Service souhaité *', 'Desired service *')}</label>
                  <select id="creative-service" name="service" required className="form-input" onChange={() => clearFieldError('service')} aria-invalid={Boolean(fieldErrors.service)} aria-describedby={fieldErrors.service ? 'creative-service-error' : undefined}>
                    <option value="">{t('Quel service vous intéresse ?', 'Which service are you interested in?')}</option>
                    <option value="Retouche & Restauration">{t('Retouche & restauration photo', 'Photo retouching & restoration')}</option>
                    <option value="Conception de Flyers">{t('Conception de flyers prestige', 'Premium flyer design')}</option>
                    <option value="Supports Visuels">{t('Supports visuels (bâches, kakemonos, roll-ups)', 'Visual materials (banners, kakemonos, roll-ups)')}</option>
                    <option value="Personnalisation">{t("Personnalisation d’objets d’art (t-shirts, mugs, etc.)", 'Personalised art objects (T-shirts, mugs, etc.)')}</option>
                    <option value="Autre">{t('Autre projet de création sur-mesure', 'Other tailored creative project')}</option>
                  </select>
                  {fieldErrors.service && <p id="creative-service-error" className="form-field-error" role="alert">{fieldErrors.service}</p>}
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="creative-message" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Description détaillée du besoin *', 'Detailed description of your needs *')}</label>
                  <textarea id="creative-message" name="message" placeholder={t('Décrivez les formats souhaités, vos objectifs de communication, vos délais et votre budget prévisionnel...', 'Describe the desired formats, communication goals, timeline and expected budget...')} required minLength={10} rows="4" className="form-input" onChange={() => clearFieldError('message')} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'creative-message-error' : undefined}></textarea>
                  {fieldErrors.message && <p id="creative-message-error" className="form-field-error" role="alert">{fieldErrors.message}</p>}
                </div>
                
                <TransactionalWhatsAppConsent id="creative-whatsapp-consent" label={t('J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.', 'I agree to receive only transactional information about this request on WhatsApp. Optional.')} help={t('Si cette option est cochée, le numéro de téléphone doit rester joignable sur WhatsApp.', 'If selected, the phone number must be reachable on WhatsApp.')} errorId={fieldErrors.phone ? 'creative-phone-error' : undefined} />

                {error && (
                  <div id="creative-quote-error" role="alert" style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.08)', border: '1px solid rgba(255, 107, 107, 0.25)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                  </div>
                )}
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1.25rem', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={submitting}>
                  {submitting ? t('Transmission en cours...', 'Sending...') : (
                    <>
                      {t('Envoyer ma demande', 'Send my request')} <Send size={15} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </Motion.div>
      </div>
    </div>
  );
};

export default CreativeServices;
