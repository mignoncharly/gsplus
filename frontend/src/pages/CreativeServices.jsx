import React, { useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Palette, PenTool, Image as ImageIcon, Shirt, Check, Send, AlertTriangle } from 'lucide-react';
import { submitQuoteRequest } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import { FRENCH_VALIDATION_SUMMARY, validationSummaryForApiError } from '../lib/form-errors';
import './CreativeServices.css';

const CREATIVE_SERVICES = [
  { 
    id: 1, 
    title: 'Retouche & Restauration', 
    desc: 'Restauration de clichés anciens ou altérés, correction colorimétrique avancée, détourage et gommage d\'imperfections d\'art.', 
    icon: <ImageIcon size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, 
    price: 'À partir de 5 000 FCFA' 
  },
  { 
    id: 2, 
    title: 'Conception de Flyers', 
    desc: 'Création de flyers commerciaux prestigieux, affiches événementielles d\'exception, formats print haute définition ou digital optimisés.', 
    icon: <PenTool size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, 
    price: 'À partir de 15 000 FCFA' 
  },
  { 
    id: 3, 
    title: 'Supports Visuels', 
    desc: 'Design et direction artistique de bâches grand format, roll-ups haut de gamme et banderoles prêtes pour un tirage d\'impression d\'art.', 
    icon: <Palette size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, 
    price: 'Sur devis' 
  },
  { 
    id: 4, 
    title: 'Objets Personnalisés', 
    desc: 'Conception de chartes visuelles élégantes pour mugs, t-shirts, coussins haut de gamme ou cadeaux d\'affaires corporatifs prestigieux.', 
    icon: <Shirt size={32} color="var(--c-gold)" style={{ transition: 'all 0.3s ease' }} />, 
    price: 'Sur devis' 
  },
];

const cardTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

const CreativeServices = () => {
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
    const message = form.get('message');

    try {
      await submitQuoteRequest({
        submissionKey: submission.submissionKey,
        name: form.get('name'),
        phone: form.get('phone'),
        email: form.get('email') || undefined,
        whatsappConsent: form.get('whatsappConsent') === 'on',
        packageName: service ? `Service créatif: ${service}` : 'Service créatif',
        message: [service ? `Service: ${service}` : null, message || 'Demande de devis créatif.']
          .filter(Boolean)
          .join('\n\n'),
        website: form.get('website') || '',
      });
      resetFormAfterSuccess(submission.formElement, true);
      setSubmitted(true);
    } catch (err) {
      submissionController.current.fail();
      const apiFields = validationErrorsFromApi(err, { name: 'name', phone: 'phone', email: 'email', packageName: 'service', message: 'message' });
      if (Object.keys(apiFields).length > 0) setFieldErrors((current) => ({ ...current, ...apiFields }));
      setError(validationSummaryForApiError(err) || "Impossible d'envoyer la demande. Veuillez réessayer.");
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
          <h1 className="creative-services-title">Services <span>Créatifs</span> & Design</h1>
          <p className="creative-services-subtitle">
            Bien plus qu'un studio photo. Nous accompagnons les professionnels exigeants et les particuliers dans la création de leurs supports de communication et produits d'art personnalisés.
          </p>
        </Motion.div>

        {/* Services Cards Grid */}
        <div className="creative-services-grid">
          {CREATIVE_SERVICES.map((s, index) => (
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
              <h3>Demande envoyée !</h3>
              <p>
                Nous avons bien reçu votre projet de design créatif. Nos directeurs de création étudient votre demande et vous recontacteront très rapidement sur WhatsApp ou par e-mail.
              </p>
              <button className="btn btn-secondary" onClick={startAnotherRequest}>
                Faire une autre demande
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-center" style={{ marginBottom: '0.5rem' }}>Demander un <span>Devis Personnalisé</span></h2>
              <p className="text-center creative-quote-subtitle">
                Présentez-nous votre projet en quelques lignes. Nos experts graphistes vous transmettront une proposition sur-mesure sous 24h.
              </p>
              
              <form onSubmit={handleSubmit} aria-describedby={error ? 'creative-quote-error' : undefined} style={{ marginTop: '2rem' }}>
                {/* Honeypot field */}
                <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="creative-name" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Nom complet ou Entreprise *</label>
                    <input id="creative-name" autoComplete="name" name="name" type="text" placeholder="Ex: Cabinet Alpha ou Eric M." required className="form-input" onChange={() => clearFieldError('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'creative-name-error' : undefined} />
                    {fieldErrors.name && <p id="creative-name-error" className="form-field-error" role="alert">{fieldErrors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="creative-phone" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Téléphone / WhatsApp *</label>
                    <input id="creative-phone" autoComplete="tel" name="phone" type="tel" inputMode="tel" placeholder="Ex: 640 70 32 49" required className="form-input" onChange={() => clearFieldError('phone')} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'creative-phone-error' : undefined} />
                    {fieldErrors.phone && <p id="creative-phone-error" className="form-field-error" role="alert">{fieldErrors.phone}</p>}
                  </div>
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="creative-email" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Adresse email (Optionnel)</label>
                  <input id="creative-email" autoComplete="email" name="email" type="email" inputMode="email" placeholder="Ex: direction@entreprise.com" className="form-input" onChange={() => clearFieldError('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'creative-email-error' : undefined} />
                  {fieldErrors.email && <p id="creative-email-error" className="form-field-error" role="alert">{fieldErrors.email}</p>}
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="creative-service" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Service souhaité *</label>
                  <select id="creative-service" name="service" required className="form-input" onChange={() => clearFieldError('service')} aria-invalid={Boolean(fieldErrors.service)} aria-describedby={fieldErrors.service ? 'creative-service-error' : undefined}>
                    <option value="">Quel service vous intéresse ?</option>
                    <option value="Retouche & Restauration">Retouche & Restauration Photo</option>
                    <option value="Conception de Flyers">Conception de Flyers Prestige</option>
                    <option value="Supports Visuels">Supports Visuels (Bâches, Kakemonos, Roll-ups)</option>
                    <option value="Personnalisation">Personnalisation d'Objets d'Art (T-shirts, Mugs, etc.)</option>
                    <option value="Autre">Autre projet de création sur-mesure</option>
                  </select>
                  {fieldErrors.service && <p id="creative-service-error" className="form-field-error" role="alert">{fieldErrors.service}</p>}
                </div>
                
                <div style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="creative-message" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Description détaillée du besoin *</label>
                  <textarea id="creative-message" name="message" placeholder="Décrivez les formats souhaités, vos objectifs de communication, vos délais et votre budget prévisionnel..." required minLength={10} rows="4" className="form-input" onChange={() => clearFieldError('message')} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'creative-message-error' : undefined}></textarea>
                  {fieldErrors.message && <p id="creative-message-error" className="form-field-error" role="alert">{fieldErrors.message}</p>}
                </div>
                
                <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', margin: '1rem 0', fontSize: '0.88rem' }}>
                  <input name="whatsappConsent" type="checkbox" style={{ marginTop: '0.2rem', accentColor: 'var(--c-gold)' }} />
                  <span>J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.</span>
                </label>

                {error && (
                  <div id="creative-quote-error" role="alert" style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.08)', border: '1px solid rgba(255, 107, 107, 0.25)', borderRadius: '4px', padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                  </div>
                )}
                
                <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1.25rem', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={submitting}>
                  {submitting ? 'Transmission en cours...' : (
                    <>
                      Envoyer ma demande <Send size={15} />
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
