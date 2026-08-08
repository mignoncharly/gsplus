import React, { useRef, useState } from 'react';
import { submitB2BInquiry } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import { FRENCH_VALIDATION_SUMMARY, validationSummaryForApiError } from '../lib/form-errors';
import { motion as Motion } from 'framer-motion';
import { Briefcase, Users, Camera, Building2, CheckCircle2, Send } from 'lucide-react';
import './Corporate.css';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
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
    });
    setFieldErrors(contactErrors);
    if (Object.keys(contactErrors).length > 0) {
      setError(FRENCH_VALIDATION_SUMMARY);
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
        subject: service ? `B2B: ${service}` : 'Demande B2B',
        message: [service ? `Prestation: ${service}` : null, details || 'Demande de devis professionnel.']
          .filter(Boolean)
          .join('\n\n'),
        website: form.get('website') || '',
      });
      resetFormAfterSuccess(submission.formElement, true);
      setSubmitted(true);
    } catch (err) {
      submissionController.current.fail();
      const apiFields = validationErrorsFromApi(err, { company: 'company', rccm: 'rccm', name: 'name', email: 'email', phone: 'phone', packageName: 'service', message: 'message' });
      if (Object.keys(apiFields).length > 0) setFieldErrors((current) => ({ ...current, ...apiFields }));
      setError(validationSummaryForApiError(err) || "Impossible d'envoyer la demande. Veuillez réessayer.");
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
              <Briefcase size={16} /> Professionnels & Entreprises
            </p>
            <h1 id="corporate-title" className="hero-title">
              Offres <span className="text-gold">B2B</span> & Corporate
            </h1>
            <p className="corporate-hero__lead">
              Améliorez l'image de votre entreprise. Nous réalisons des portraits professionnels pour vos collaborateurs et couvrons vos événements d'entreprise avec soin et professionnalisme.
            </p>
          </Motion.div>
        </div>
      </section>

      <section className="py-section">
        <div className="container">
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
              <h3>Trombinoscope & Portraits</h3>
              <p>Harmonisez la présentation de vos équipes. Portraits corporate sur fond uni ou en situation pour vos rapports et sites web.</p>
            </Motion.div>
            
            <Motion.div className="feature-card" variants={fadeIn}>
              <div className="icon-wrap">
                <Camera size={32} />
              </div>
              <h3>Couverture Événementielle</h3>
              <p>Immortalisez vos séminaires, galas, inaugurations ou conférences avec des reportages photographiques adaptés à l'événement.</p>
            </Motion.div>

            <Motion.div className="feature-card" variants={fadeIn}>
              <div className="icon-wrap">
                <Building2 size={32} />
              </div>
              <h3>Publicité & Packshots</h3>
              <p>Mettez en valeur vos produits ou vos locaux avec des images haute résolution destinées à la publicité et au e-commerce.</p>
            </Motion.div>
          </Motion.div>

          {/* Devis Form */}
          <div className="corporate-devis-wrap">
            <Motion.div 
              className="devis-section"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="devis-section__bg" />
              <div className="devis-section__content">
                {submitted ? (
                  <Motion.div 
                    className="success-message glass-dark"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <CheckCircle2 size={56} className="text-gold" style={{ margin: '0 auto' }} />
                    <h3>Demande envoyée avec succès</h3>
                    <p>Notre équipe B2B étudiera attentivement vos besoins et reviendra vers vous avec une proposition sur mesure très rapidement.</p>
                    <button className="btn btn-secondary" onClick={startAnotherRequest}>
                      Nouvelle demande
                    </button>
                  </Motion.div>
                ) : (
                  <>
                    <h2>Demande de devis B2B</h2>
                    <p className="lead">Obtenez une proposition tarifaire personnalisée pour votre structure.</p>

                    <form onSubmit={handleSubmit} aria-describedby={error ? 'b2b-form-error' : undefined}>
                      <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                      <div className="form-row">
                        <div>
                          <label className="form-label" htmlFor="b2b-company">Nom de l'entreprise *</label>
                          <input id="b2b-company" autoComplete="organization" name="company" type="text" placeholder="Ex: Groupe S.A." required className="form-input corporate-form-input" onChange={() => clearFieldError('company')} aria-invalid={Boolean(fieldErrors.company)} aria-describedby={fieldErrors.company ? 'b2b-company-error' : undefined} />
                          {fieldErrors.company && <p id="b2b-company-error" className="form-field-error" role="alert">{fieldErrors.company}</p>}
                        </div>
                        <div>
                          <label className="form-label" htmlFor="b2b-rccm">NIU / RCCM *</label>
                          <input id="b2b-rccm" autoComplete="off" name="rccm" type="text" placeholder="Numéro d'enregistrement" required className="form-input corporate-form-input" onChange={() => clearFieldError('rccm')} aria-invalid={Boolean(fieldErrors.rccm)} aria-describedby={fieldErrors.rccm ? 'b2b-rccm-error' : undefined} />
                          {fieldErrors.rccm && <p id="b2b-rccm-error" className="form-field-error" role="alert">{fieldErrors.rccm}</p>}
                        </div>
                      </div>

                      <div className="form-row">
                        <div>
                          <label className="form-label" htmlFor="b2b-name">Personne de contact *</label>
                          <input id="b2b-name" autoComplete="name" name="name" type="text" placeholder="Nom du responsable" required className="form-input corporate-form-input" onChange={() => clearFieldError('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'b2b-name-error' : undefined} />
                          {fieldErrors.name && <p id="b2b-name-error" className="form-field-error" role="alert">{fieldErrors.name}</p>}
                        </div>
                        <div>
                          <label className="form-label" htmlFor="b2b-phone">Téléphone direct *</label>
                          <input id="b2b-phone" autoComplete="tel" name="phone" type="tel" inputMode="tel" placeholder="Ex : 233 42 11 22" required className="form-input corporate-form-input" onChange={() => clearFieldError('phone')} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'b2b-phone-error' : undefined} />
                          {fieldErrors.phone && <p id="b2b-phone-error" className="form-field-error" role="alert">{fieldErrors.phone}</p>}
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                          <label className="form-label" htmlFor="b2b-email">Email de l'entreprise *</label>
                          <input id="b2b-email" autoComplete="email" name="email" type="email" inputMode="email" placeholder="contact@entreprise.cm" required className="form-input corporate-form-input" onChange={() => clearFieldError('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'b2b-email-error' : undefined} />
                          {fieldErrors.email && <p id="b2b-email-error" className="form-field-error" role="alert">{fieldErrors.email}</p>}
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
                        <div>
                          <label className="form-label" htmlFor="b2b-service">Nature du besoin *</label>
                          <select id="b2b-service" name="service" required className="form-input corporate-form-input" defaultValue="" onChange={() => clearFieldError('service')} aria-invalid={Boolean(fieldErrors.service)} aria-describedby={fieldErrors.service ? 'b2b-service-error' : undefined}>
                            <option value="" disabled hidden>Sélectionnez le type de prestation</option>
                            <option value="Portraits de collaborateurs">Portraits de collaborateurs (Trombinoscope)</option>
                            <option value="Couverture evenementielle">Couverture photographique événementielle</option>
                            <option value="Photographie de produits">Photographie de produits (Packshots)</option>
                            <option value="Autre">Autre (préciser ci-dessous)</option>
                          </select>
                          {fieldErrors.service && <p id="b2b-service-error" className="form-field-error" role="alert">{fieldErrors.service}</p>}
                        </div>
                      </div>

                      <div className="form-row" style={{ gridTemplateColumns: '1fr', marginBottom: '2rem' }}>
                        <div>
                          <label className="form-label" htmlFor="b2b-message">Détails (effectif, budget, lieu...) *</label>
                          <textarea id="b2b-message" name="message" rows="4" minLength={10} required className="form-input corporate-form-input" placeholder="Décrivez votre projet ici..." style={{ resize: 'vertical' }} onChange={() => clearFieldError('message')} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'b2b-message-error' : undefined}></textarea>
                          {fieldErrors.message && <p id="b2b-message-error" className="form-field-error" role="alert">{fieldErrors.message}</p>}
                        </div>
                      </div>

                      <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                        <input name="whatsappConsent" type="checkbox" style={{ marginTop: '0.2rem', accentColor: 'var(--c-gold)' }} />
                        <span>J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.</span>
                      </label>

                      {error && <p id="b2b-form-error" role="alert" style={{ color: '#FED7D7', marginBottom: '1.5rem', fontWeight: 700, textAlign: 'center' }}>{error}</p>}
                      
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }} disabled={submitting}>
                        <Send size={20} />
                        {submitting ? 'Envoi en cours...' : 'Envoyer la demande de devis'}
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
