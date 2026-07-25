import React, { useRef, useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, CheckCircle2, MessageSquareText } from 'lucide-react';
import { motion as Motion } from 'framer-motion';
import { submitContact } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import './Contact.css';

const fadeIn = {
  initial: { y: 20 },
  animate: { y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.15
    }
  }
};

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submissionController = useRef(createLeadSubmissionController());

  const startAnotherMessage = () => {
    submissionController.current.next();
    setError('');
    setSubmitted(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submission = submissionController.current.start(event.currentTarget);
    if (!submission) return;

    setError('');
    setSubmitting(true);

    const form = new FormData(submission.formElement);
    try {
      await submitContact({
        submissionKey: submission.submissionKey,
        name: form.get('name'),
        email: form.get('email'),
        phone: form.get('phone') || undefined,
        whatsappConsent: form.get('whatsappConsent') === 'on',
        subject: 'Contact site web',
        message: form.get('message'),
        website: form.get('website') || '',
      });
      resetFormAfterSuccess(submission.formElement, true);
      setSubmitted(true);
    } catch (err) {
      submissionController.current.fail();
      setError(err.message || "Impossible d'envoyer le message. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      {/* Hero Section */}
      <section className="contact-hero" aria-labelledby="contact-title">
        <div className="contact-hero__bg" />
        <div className="container contact-hero__content">
          <Motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="home-section-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <MessageSquareText size={16} /> Échangeons ensemble
            </p>
            <h1 id="contact-title" className="hero-title">
              Nous <span className="text-gold">Contacter</span>
            </h1>
            <p className="contact-hero__lead">
              Vous avez une question, un projet spécial ou besoin d'assistance ? Notre équipe est à votre écoute pour donner vie à vos envies.
            </p>
          </Motion.div>
        </div>
      </section>

      <section className="py-section">
        <div className="container">
          <div className="contact-grid">

            {/* Left: Contact Info */}
            <Motion.div
              className="contact-info-list"
              variants={staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-50px" }}
            >
              <Motion.div className="contact-info-card" variants={fadeIn}>
                <div className="icon-wrap">
                  <MapPin size={24} />
                </div>
                <div className="content">
                  <h3>Notre Studio</h3>
                  <p>Douala (Cité des palmiers)<br />Cameroun</p>
                </div>
              </Motion.div>

              <Motion.div className="contact-info-card" variants={fadeIn}>
                <div className="icon-wrap">
                  <Phone size={24} />
                </div>
                <div className="content">
                  <h3>Téléphone / WhatsApp</h3>
                  <p>
                    <a href="tel:+237673026654">+237 673 026 654</a>
                  </p>
                </div>
              </Motion.div>

              <Motion.div className="contact-info-card" variants={fadeIn}>
                <div className="icon-wrap">
                  <Mail size={24} />
                </div>
                <div className="content">
                  <h3>Assistance par e-mail</h3>
                  <p>
                    <a href="mailto:info@gsplus.vip">info@gsplus.vip</a>
                  </p>
                </div>
              </Motion.div>

              <Motion.div className="contact-info-card" variants={fadeIn}>
                <div className="icon-wrap">
                  <Clock size={24} />
                </div>
                <div className="content">
                  <h3>Horaires d'ouverture</h3>
                  <p>
                    <strong>Du lundi au samedi :</strong> 9 h - 18 h<br />
                    <strong>Dimanche :</strong> Fermé, sauf rendez-vous VIP préalable
                  </p>
                </div>
              </Motion.div>
            </Motion.div>

            {/* Right: Contact Form */}
            <Motion.div
              className="contact-form-wrap"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div className="contact-form-wrap__bg" />
              <div className="contact-form-wrap__content">
                {submitted ? (
                  <Motion.div
                    className="success-message glass-dark"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <CheckCircle2 size={56} className="text-gold" style={{ margin: '0 auto' }} />
                    <h3>Message envoyé !</h3>
                    <p>Nous avons bien reçu votre demande et nous vous répondrons dans les plus brefs délais.</p>
                    <button className="btn btn-secondary" onClick={startAnotherMessage}>
                      Envoyer un autre message
                    </button>
                  </Motion.div>
                ) : (
                  <>
                    <h2>Écrivez-nous</h2>
                    <p className="lead">Remplissez le formulaire ci-dessous et nous vous recontacterons après étude de votre demande.</p>

                    <form onSubmit={handleSubmit} aria-describedby={error ? 'contact-form-error' : undefined}>
                      <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
                      <div className="form-row split">
                        <div>
                          <label className="form-label" htmlFor="contact-name">Nom complet *</label>
                          <input id="contact-name" autoComplete="name" name="name" type="text" placeholder="Votre nom" required className="form-input contact-form-input" />
                        </div>
                        <div>
                          <label className="form-label" htmlFor="contact-email">Email *</label>
                          <input id="contact-email" autoComplete="email" name="email" type="email" placeholder="votre@email.com" required className="form-input contact-form-input" />
                        </div>
                      </div>

                      <div className="form-row">
                        <div>
                          <label className="form-label" htmlFor="contact-phone">Téléphone (requis uniquement pour WhatsApp)</label>
                          <input id="contact-phone" autoComplete="tel" name="phone" type="tel" placeholder="Ex : +237 6xx xx xx xx" className="form-input contact-form-input" />
                        </div>
                      </div>

                      <div className="form-row">
                        <div>
                          <label className="form-label" htmlFor="contact-message">Votre message *</label>
                          <textarea id="contact-message" name="message" placeholder="Comment pouvons-nous vous aider ?" required minLength={10} rows="5" className="form-input contact-form-input" style={{ resize: 'vertical' }}></textarea>
                        </div>
                      </div>

                      <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                        <input name="whatsappConsent" type="checkbox" style={{ marginTop: '0.2rem', accentColor: 'var(--c-gold)' }} />
                        <span>J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.</span>
                      </label>

                      {error && <p id="contact-form-error" role="alert" style={{ color: '#FED7D7', marginBottom: '1.5rem', fontWeight: 700, textAlign: 'center' }}>{error}</p>}

                      <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }} disabled={submitting}>
                        <Send size={20} />
                        {submitting ? 'Envoi en cours...' : 'Envoyer le message'}
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

export default Contact;
