import React, { useRef, useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, MessageSquareText } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { submitContact } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import { validationSummaryForApiError } from '../lib/form-errors';
import { useLocale } from '../lib/i18n.js';
import TransactionalWhatsAppConsent from '../components/TransactionalWhatsAppConsent';
import './Contact.css';

const fadeIn = { initial: { y: 20 }, animate: { y: 0 }, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } };
const staggerContainer = { animate: { transition: { staggerChildren: 0.15 } } };

const copyFor = (locale) => locale === 'en' ? {
  conversation: 'Let’s talk', titlePrefix: 'Contact', titleAccent: 'us', lead: 'Have a question, a special project or need support? Our team is here to bring your ideas to life.', studio: 'Our studio', country: 'Cameroon', phone: 'Phone / WhatsApp', emailSupport: 'Email support', hours: 'Opening hours', weekdays: 'Monday to Saturday:', sunday: 'Sunday:', sundayValue: 'Closed, except by prior VIP appointment', sent: 'Message sent!', sentBody: 'We received your request and will get back to you as soon as possible.', another: 'Send another message', heading: 'Write to us', formLead: 'Complete the form below and we will contact you after reviewing your request.', name: 'Full name *', namePlaceholder: 'Your name', phoneLabel: 'Phone (required only for WhatsApp)', phonePlaceholder: 'E.g. 640 70 32 49', message: 'Your message *', messagePlaceholder: 'How can we help?', whatsapp: 'I agree to receive on WhatsApp only transactional information related to this request. Optional.', sending: 'Sending…', send: 'Send message', subject: 'Website contact', validation: 'Please correct the fields highlighted below.', sendFailed: 'Unable to send the message. Please try again.',
} : {
  conversation: 'Échangeons ensemble', titlePrefix: 'Nous', titleAccent: 'contacter', lead: 'Vous avez une question, un projet spécial ou besoin d’assistance ? Notre équipe est à votre écoute pour donner vie à vos envies.', studio: 'Notre Studio', country: 'Cameroun', phone: 'Téléphone / WhatsApp', emailSupport: 'Assistance par e-mail', hours: 'Horaires d’ouverture', weekdays: 'Du lundi au samedi :', sunday: 'Dimanche :', sundayValue: 'Fermé, sauf rendez-vous VIP préalable', sent: 'Message envoyé !', sentBody: 'Nous avons bien reçu votre demande et nous vous répondrons dans les plus brefs délais.', another: 'Envoyer un autre message', heading: 'Écrivez-nous', formLead: 'Remplissez le formulaire ci-dessous et nous vous recontacterons après étude de votre demande.', name: 'Nom complet *', namePlaceholder: 'Votre nom', phoneLabel: 'Téléphone (requis uniquement pour WhatsApp)', phonePlaceholder: 'Ex. : 640 70 32 49', message: 'Votre message *', messagePlaceholder: 'Comment pouvons-nous vous aider ?', whatsapp: 'J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.', sending: 'Envoi en cours…', send: 'Envoyer le message', subject: 'Contact site web', validation: 'Corrigez les champs indiqués ci-dessous.', sendFailed: 'Impossible d’envoyer le message. Veuillez réessayer.',
};

const Contact = () => {
  const { locale } = useLocale();
  const copy = copyFor(locale);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const submissionController = useRef(createLeadSubmissionController());
  const startAnotherMessage = () => { submissionController.current.next(); setError(''); setFieldErrors({}); setSubmitted(false); };
  const clearFieldError = (field) => setFieldErrors((current) => { if (!current[field]) return current; const next = { ...current }; delete next[field]; return next; });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const contactErrors = validateContactFields({ phone: form.get('phone'), email: form.get('email'), emailRequired: true, whatsappConsent: form.get('whatsappConsent') === 'on', locale });
    setFieldErrors(contactErrors);
    if (Object.keys(contactErrors).length > 0) { setError(copy.validation); return; }
    const submission = submissionController.current.start(formElement);
    if (!submission) return;
    setError(''); setSubmitting(true);
    try {
      await submitContact({ submissionKey: submission.submissionKey, name: form.get('name'), email: form.get('email'), phone: form.get('phone') || undefined, whatsappConsent: form.get('whatsappConsent') === 'on', subject: copy.subject, message: form.get('message'), website: form.get('website') || '' });
      resetFormAfterSuccess(submission.formElement, true); setSubmitted(true);
    } catch (err) {
      submissionController.current.fail();
      const apiFields = validationErrorsFromApi(err, { name: 'name', email: 'email', phone: 'phone', message: 'message' }, locale);
      if (Object.keys(apiFields).length > 0) setFieldErrors((current) => ({ ...current, ...apiFields }));
      setError(locale === 'en' ? copy.sendFailed : validationSummaryForApiError(err, locale) || copy.sendFailed);
    } finally { setSubmitting(false); }
  };

  return <div className="contact-page">
    <section className="contact-hero" aria-labelledby="contact-title"><div className="contact-hero__bg" /><div className="container contact-hero__content"><Motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
      <p className="home-section-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><MessageSquareText size={16} /> {copy.conversation}</p>
      <h1 id="contact-title" className="hero-title">{copy.titlePrefix} <span className="text-gold">{copy.titleAccent}</span></h1><p className="contact-hero__lead">{copy.lead}</p>
    </Motion.div></div></section>
    <section className="py-section"><div className="container"><div className="contact-grid">
      <Motion.div className="contact-info-list" variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true, margin: '-50px' }}>
        <Motion.div className="contact-info-card" variants={fadeIn}><div className="icon-wrap"><MapPin size={24} /></div><div className="content"><h3>{copy.studio}</h3><p>Douala (Cité des palmiers)<br />{copy.country}</p></div></Motion.div>
        <Motion.div className="contact-info-card" variants={fadeIn}><div className="icon-wrap"><Phone size={24} /></div><div className="content"><h3>{copy.phone}</h3><p><a href="tel:+237673026654">+237 673 026 654</a></p></div></Motion.div>
        <Motion.div className="contact-info-card" variants={fadeIn}><div className="icon-wrap"><Mail size={24} /></div><div className="content"><h3>{copy.emailSupport}</h3><p><a href="mailto:info@gsplus.vip">info@gsplus.vip</a></p></div></Motion.div>
        <Motion.div className="contact-info-card" variants={fadeIn}><div className="icon-wrap"><Clock size={24} /></div><div className="content"><h3>{copy.hours}</h3><p><strong>{copy.weekdays}</strong> 9 h - 18 h<br /><strong>{copy.sunday}</strong> {copy.sundayValue}</p></div></Motion.div>
      </Motion.div>
      <Motion.div className="contact-form-wrap" initial={{ opacity: 1, x: 0 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}><div className="contact-form-wrap__bg" /><div className="contact-form-wrap__content">
        {submitted ? <Motion.div className="success-message glass-dark" role="status" aria-live="polite" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}><CheckCircle2 size={56} className="text-gold" style={{ margin: '0 auto' }} /><h3>{copy.sent}</h3><p>{copy.sentBody}</p><button type="button" className="btn btn-secondary" onClick={startAnotherMessage}>{copy.another}</button></Motion.div> : <>
          <h2>{copy.heading}</h2><p className="lead">{copy.formLead}</p>
          <form onSubmit={handleSubmit} aria-describedby={error ? 'contact-form-error' : undefined}>
            <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
            <div className="form-row split"><div><label className="form-label" htmlFor="contact-name">{copy.name}</label><input id="contact-name" autoComplete="name" name="name" type="text" placeholder={copy.namePlaceholder} required className="form-input contact-form-input" onChange={() => clearFieldError('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined} />{fieldErrors.name && <p id="contact-name-error" className="form-field-error" role="alert">{fieldErrors.name}</p>}</div><div><label className="form-label" htmlFor="contact-email">Email *</label><input id="contact-email" autoComplete="email" name="email" type="email" inputMode="email" placeholder="you@email.com" required className="form-input contact-form-input" onChange={() => clearFieldError('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined} />{fieldErrors.email && <p id="contact-email-error" className="form-field-error" role="alert">{fieldErrors.email}</p>}</div></div>
            <div className="form-row"><div><label className="form-label" htmlFor="contact-phone">{copy.phoneLabel}</label><input id="contact-phone" autoComplete="tel" name="phone" type="tel" inputMode="tel" placeholder={copy.phonePlaceholder} className="form-input contact-form-input" onChange={() => clearFieldError('phone')} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'contact-phone-error' : undefined} />{fieldErrors.phone && <p id="contact-phone-error" className="form-field-error" role="alert">{fieldErrors.phone}</p>}</div></div>
            <div className="form-row"><div><label className="form-label" htmlFor="contact-message">{copy.message}</label><textarea id="contact-message" name="message" placeholder={copy.messagePlaceholder} required minLength={10} rows="5" className="form-input contact-form-input" style={{ resize: 'vertical' }} onChange={() => clearFieldError('message')} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? 'contact-message-error' : undefined} />{fieldErrors.message && <p id="contact-message-error" className="form-field-error" role="alert">{fieldErrors.message}</p>}</div></div>
            <TransactionalWhatsAppConsent id="contact-whatsapp-consent" label={copy.whatsapp} help={locale === 'en' ? 'If selected, a valid Cameroon phone number is required.' : 'Si cette option est cochée, un numéro camerounais valide est obligatoire.'} errorId={fieldErrors.phone ? 'contact-phone-error' : undefined} />
            {error && <p id="contact-form-error" role="alert" style={{ color: '#FED7D7', marginBottom: '1.5rem', fontWeight: 700, textAlign: 'center' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }} disabled={submitting}><Send size={20} />{submitting ? copy.sending : copy.send}</button>
          </form>
        </>}
      </div></Motion.div>
    </div></div></section>
  </div>;
};

export default Contact;
