import React, { useRef, useState } from 'react';
import { submitB2BInquiry } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import { validationSummaryForApiError } from '../lib/form-errors';
import { motion as Motion } from 'framer-motion';
import { Briefcase, Users, Camera, Building2, CheckCircle2, Send } from 'lucide-react';
import './Corporate.css';
import { useLocale } from '../lib/i18n.js';
import TransactionalWhatsAppConsent from '../components/TransactionalWhatsAppConsent';
import { useSiteSettings } from '../lib/use-site-settings';

const fadeIn = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15
    }
  }
};

const Corporate = () => {
  const { locale } = useLocale();
  const { settings } = useSiteSettings();
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
      emailRequired: true,
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
    const details = form.get('message');

    try {
      await submitB2BInquiry({
        submissionKey: submission.submissionKey,
        company: form.get('company'),
        rccm: form.get('rccm'),
        name: form.get('name'),
        email: form.get('email'),
        phone: form.get('phone'),
        whatsappConsent: form.get('whatsappConsent') === 'on',
        subject: service ? `B2B: ${service}` : t('Demande B2B', 'B2B request'),
        message: [service ? `${t('Prestation', 'Service')}: ${service}` : null, details || t('Demande de devis professionnel.', 'Professional quote request.')]
          .filter(Boolean)
          .join('\n\n'),
        website: form.get('website') || '',
      });
      resetFormAfterSuccess(submission.formElement, true);
      setSubmitted(true);
    } catch (err) {
      submissionController.current.fail();
      const apiFields = validationErrorsFromApi(err, { company: 'company', rccm: 'rccm', name: 'name', email: 'email', phone: 'phone', packageName: 'service', message: 'message' }, locale);
      if (Object.keys(apiFields).length > 0) setFieldErrors((current) => ({ ...current, ...apiFields }));
      setError(validationSummaryForApiError(err, locale) || t("Impossible d’envoyer la demande. Veuillez réessayer.", 'Unable to send the request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="corporate-page">
      {/* Hero Section */}
      <section className="corporate-hero" aria-labelledby="corporate-title">
        <div className="corporate-hero__bg" />
        <div className="container corporate-hero__content">
          <Motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="home-section-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Briefcase size={16} /> {t('Professionnels & entreprises', 'Professionals & businesses')}
            </p>
            <h1 id="corporate-title" className="hero-title">
              {t('Offres', 'Offers')} <span className="text-gold">B2B</span> & Corporate
            </h1>
            <p className="corporate-hero__lead">
              {t("Améliorez l’image de votre entreprise. Nous réalisons des portraits professionnels pour vos collaborateurs et couvrons vos événements d’entreprise avec soin et professionnalisme.", 'Enhance your company image. We create professional portraits for your team and cover your corporate events with care and professionalism.')}
            </p>
          </Motion.div>
        </div>
      </section>

      <section className="py-section">
        <div className="container">
          <h2 className="text-center">{t('Solutions pour votre organisation', 'Solutions for your organisation')}</h2>
          {/* Services B2B Features */}
          <Motion.div 
            className="b2b-features-grid"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: "-50px" }}
          >
            <Motion.div className="feature-card" variants={fadeIn}>
              <div className="icon-wrap">
                <Users size={32} />
              </div>
              <h3>{t('Trombinoscope & portraits', 'Staff directory & portraits')}</h3>
              <p>{t('Harmonisez la présentation de vos équipes. Portraits corporate sur fond uni ou en situation pour vos rapports et sites web.', 'Present your teams consistently with corporate portraits on a plain background or in context for reports and websites.')}</p>
            </Motion.div>
            
            <Motion.div className="feature-card" variants={fadeIn}>
              <div className="icon-wrap">
                <Camera size={32} />
              </div>
              <h3>{t('Couverture événementielle', 'Event coverage')}</h3>
              <p>{t('Immortalisez vos séminaires, galas, inaugurations ou conférences avec des reportages photographiques adaptés à l’événement.', 'Capture your seminars, galas, openings or conferences with photography tailored to the event.')}</p>
            </Motion.div>

            <Motion.div className="feature-card" variants={fadeIn}>
              <div className="icon-wrap">
                <Building2 size={32} />
              </div>
              <h3>{t('Publicité & packshots', 'Advertising & packshots')}</h3>
              <p>{t('Mettez en valeur vos produits ou vos locaux avec des images haute résolution destinées à la publicité et au e-commerce.', 'Showcase your products or premises with high-resolution images for advertising and e-commerce.')}</p>
            </Motion.div>
          </Motion.div>

          {/* Devis Form */}
          <div className="corporate-devis-wrap">
            <Motion.div 
              className="devis-section"
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="devis-section__bg" />
              <div className="devis-section__content">
                {!settings.features.b2bFormEnabled ? <p className="lead">{t('Le formulaire entreprise est temporairement indisponible. Utilisez les coordonnées publiées du Studio.', 'The business form is temporarily unavailable. Please use the Studio’s published contact details.')}</p> : submitted ? (
                  <Motion.div 
                    className="success-message glass-dark"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <CheckCircle2 size={56} className="text-gold" style={{ margin: '0 auto' }} />
                    <h2>{t('Demande envoyée avec succès', 'Request sent successfully')}</h2>
                    <p>{t('Notre équipe B2B étudiera attentivement vos besoins et reviendra vers vous avec une proposition sur mesure très rapidement.', 'Our B2B team will carefully review your needs and get back to you shortly with a tailored proposal.')}</p>
                    <button className="btn btn-secondary" onClick={startAnotherRequest}>
                      {t('Nouvelle demande', 'New request')}
                    </button>
                  </Motion.div>
                ) : (
                  <>
                    <h2>{t('Demande de devis B2B', 'B2B quote request')}</h2>
                    <p className="lead">{t('Obtenez une proposition tarifaire personnalisée pour votre structure.', 'Get a tailored pricing proposal for your organisation.')}</p>

                    <form onSubmit={handleSubmit} aria-describedby={error ? 'b2b-form-error' : undefined}>
                      <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                      <div className="form-row">
                        <div>
                          <label className="form-label" htmlFor="b2b-company">{t("Nom de l’entreprise *", 'Company name *')}</label>
                          <input id="b2b-company" autoComplete="organization" name="company" type="text" placeholder={t('Ex. : Groupe S.A.', 'E.g. Group S.A.')} required className="form-input corporate-form-input" onChange={() => clearFieldError('company')} aria-invalid={Boolean(fieldErrors.company)} aria-describedby={fieldErrors.company ? 'b2b-company-error' : undefined} />
                          {fieldErrors.company && <p id="b2b-company-error" className="form-field-error" role="alert">{fieldErrors.company}</p>}
                        </div>
                        <div>
                          <label className="form-label" htmlFor="b2b-rccm">NIU / RCCM *</label>
                          <input id="b2b-rccm" autoComplete="off" name="rccm" type="text" placeholder={t("Numéro d’enregistrement", 'Registration number')} required className="form-input corporate-form-input" onChange={() => clearFieldError('rccm')} aria-invalid={Boolean(fieldErrors.rccm)} aria-describedby={fieldErrors.rccm ? 'b2b-rccm-error' : undefined} />
                          {fieldErrors.rccm && <p id="b2b-rccm-error" className="form-field-error" role="alert">{fieldErrors.rccm}</p>}
                        </div>
                      </div>

                      <div className="form-row">
                        <div>
                          <label className="form-label" htmlFor="b2b-name">{t('Personne de contact *', 'Contact person *')}</label>
                          <input id="b2b-name" autoComplete="name" name="name" type="text" placeholder={t('Nom du responsable', 'Contact name')} required className="form-input corporate-form-input" onChange={() => clearFieldError('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'b2b-name-error' : undefined} />
                          {fieldErrors.name && <p id="b2b-name-error" className="form-field-error" role="alert">{fieldErrors.name}</p>}
                        </div>
                        <div>
                          <label className="form-label" htmlFor="b2b-phone">{t('Téléphone direct *', 'Direct phone *')}</label>
                          <input id="b2b-phone" autoComplete="tel" name="phone" type="tel" inputMode="tel" placeholder={t('Ex. : 233 42 11 22', 'E.g. 233 42 11 22')} required className="form-input corporate-form-input" onChange={() => clearFieldError('phone')} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'b2b-phone-error' : undefined} />
                          {fieldErrors.phone && <p id="b2b-phone-error" className="form-field-error" role="alert">{fieldErrors.phone}</p>}
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                          <label className="form-label" htmlFor="b2b-email">{t("E-mail de l’entreprise *", 'Company email *')}</label>
                          <input id="b2b-email" autoComplete="email" name="email" type="email" inputMode="email" placeholder="contact@entreprise.cm" required className="form-input corporate-form-input" onChange={() => clearFieldError('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'b2b-email-error' : undefined} />
                          {fieldErrors.email && <p id="b2b-email-error" className="form-field-error" role="alert">{fieldErrors.email}</p>}
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                          <label className="form-label" htmlFor="b2b-service">{t('Nature du besoin *', 'Type of service needed *')}</label>
                          <select id="b2b-service" name="service" required className="form-input corporate-form-input" defaultValue="" onChange={() => clearFieldError('service')} aria-invalid={Boolean(fieldErrors.service)} aria-describedby={fieldErrors.service ? 'b2b-service-error' : undefined}>
                            <option value="" disabled hidden>{t('Sélectionnez le type de prestation', 'Select the service type')}</option>
                            <option value="Portraits de collaborateurs">{t('Portraits de collaborateurs (trombinoscope)', 'Employee portraits (staff directory)')}</option>
                            <option value="Couverture evenementielle">{t('Couverture photographique événementielle', 'Event photography coverage')}</option>
                            <option value="Photographie de produits">{t('Photographie de produits (packshots)', 'Product photography (packshots)')}</option>
                            <option value="Autre">{t('Autre (préciser ci-dessous)', 'Other (please specify below)')}</option>
                          </select>
                          {fieldErrors.service && <p id="b2b-service-error" className="form-field-error" role="alert">{fieldErrors.service}</p>}
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                        <div>
                          <label className="form-label" htmlFor="b2b-message">{t('Détails (effectif, budget, lieu...) *', 'Details (team size, budget, location...) *')}</label>
                          <textarea id="b2b-message" name="message" rows="4" minLength={10} required className="form-input corporate-form-input" placeholder={t('Décrivez votre projet ici...', 'Describe your project here...')} style={{ resize: 'vertical' }} onChange={() => clearFieldError('message')} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'b2b-message-error' : undefined}></textarea>
                          {fieldErrors.message && <p id="b2b-message-error" className="form-field-error" role="alert">{fieldErrors.message}</p>}
                        </div>
                      </div>

                      <TransactionalWhatsAppConsent id="b2b-whatsapp-consent" label={t('J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.', 'I agree to receive only transactional information about this request on WhatsApp. Optional.')} help={t('Si cette option est cochée, le numéro de téléphone doit rester joignable sur WhatsApp.', 'If selected, the phone number must be reachable on WhatsApp.')} errorId={fieldErrors.phone ? 'b2b-phone-error' : undefined} />

                      {error && <p id="b2b-form-error" role="alert" style={{ color: '#FED7D7', marginBottom: '1.5rem', fontWeight: 700, textAlign: 'center' }}>{error}</p>}
                      
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }} disabled={submitting}>
                        <Send size={20} />
                        {submitting ? t('Envoi en cours...', 'Sending...') : t('Envoyer la demande de devis', 'Send quote request')}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </Motion.div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Corporate;
