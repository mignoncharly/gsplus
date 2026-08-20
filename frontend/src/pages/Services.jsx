import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Camera, Palette, Printer, Image as ImageIcon, FileText, LayoutTemplate, Shirt, BookOpen, Frame, CheckCircle2, Clock3, Images, MessageCircle, Sparkles, Send } from 'lucide-react';
import { getPackages, submitQuoteRequest } from '../lib/api';
import { createLeadSubmissionController, resetFormAfterSuccess } from '../lib/lead-submission';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import { validationSummaryForApiError } from '../lib/form-errors';
import { packageCtaLabel, packageView, shootingCategoriesForLocale } from '../lib/packages';
import { formatFcfa } from '../lib/display-formatters';
import { cataloguePromotionsForLocale } from '../content/catalogue-promotions';
import ServiceGallery from '../components/ServiceGallery';
import TransactionalWhatsAppConsent from '../components/TransactionalWhatsAppConsent';
import { useLocale } from '../lib/i18n.js';
import './Services.css';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.08 }
  }
};
const designServices = (locale) => locale === 'en' ? [
  { id: 1, icon: <ImageIcon size={32} />, title: 'Retouching & Restoration', desc: 'Restoration of old or damaged photos, advanced colour retouching and background removal.', price: 'From 5,000 FCFA' },
  { id: 2, icon: <FileText size={32} />, title: 'Flyer & Poster Design', desc: 'Commercial flyers, event posters, print or digital formats and personalised design.', price: 'From 15,000 FCFA' },
  { id: 3, icon: <LayoutTemplate size={32} />, title: 'Visual Materials', desc: 'Banners, roll-ups, signage and display materials ready to print for events and businesses.', price: 'Quote on request' },
  { id: 4, icon: <Shirt size={32} />, title: 'Personalised Products', desc: 'Visuals for mugs, T-shirts, cushions, tote bags, corporate gifts and promotional items.', price: 'Quote on request' },
] : [
  { id: 1, icon: <ImageIcon size={32} />, title: 'Retouche & Restauration', desc: 'Restauration de photos anciennes ou abîmées, retouche colorimétrique avancée, suppression d’arrière-plan.', price: 'À partir de 5 000 FCFA' },
  { id: 2, icon: <FileText size={32} />, title: 'Conception de Flyers & Affiches', desc: 'Création de flyers commerciaux, affiches pour événements, format print ou digital, design personnalisé.', price: 'À partir de 15 000 FCFA' },
  { id: 3, icon: <LayoutTemplate size={32} />, title: 'Supports Visuels', desc: 'Design de bâches, roll-ups, banderoles et signalétique prêtes à imprimer pour vos événements et commerces.', price: 'Sur devis' },
  { id: 4, icon: <Shirt size={32} />, title: 'Objets Personnalisés', desc: 'Création de visuels pour mugs, t-shirts, coussins, tote bags, cadeaux d’entreprise et goodies promotionnels.', price: 'Sur devis' },
];

const printServices = (locale) => locale === 'en' ? [
  { id: 1, icon: <Printer size={32} />, title: 'Professional Photo Printing', desc: 'High-quality premium-paper prints, from 10×15 to 30×45 cm. Matte, glossy or satin finishes.', price: 'From 1,500 FCFA / print' },
  { id: 2, icon: <BookOpen size={32} />, title: 'Albums & Portfolios', desc: 'Wedding albums, professional portfolios and product catalogues. Hard covers, premium binding and complete personalisation.', price: 'From 35,000 FCFA' },
  { id: 3, icon: <Frame size={32} />, title: 'Posters, Frames & Fine-Art Prints', desc: 'Canvas prints (20×30 to 40×60 cm), large-format posters and framed fine-art prints for interior decoration.', price: 'From 15,000 FCFA' },
] : [
  { id: 1, icon: <Printer size={32} />, title: 'Impression Photo Professionnelle', desc: 'Tirages haute qualité sur papier premium, formats 10×15 au 30×45 cm. Finitions mat, brillant ou satiné.', price: 'À partir de 1 500 FCFA / tirage' },
  { id: 2, icon: <BookOpen size={32} />, title: 'Albums & Portfolios', desc: 'Albums de mariage, portfolios professionnels, catalogues produits. Couverture rigide, reliure premium, personnalisation complète.', price: 'À partir de 35 000 FCFA' },
  { id: 3, icon: <Frame size={32} />, title: 'Posters, Cadres & Tirages d’art', desc: 'Toiles canvas (20×30 à 40×60 cm), posters grand format, tirages d’art encadrés pour décoration intérieure.', price: 'À partir de 15 000 FCFA' },
];

const DevisForm = ({ context, options, formId }) => {
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
        packageName: service || context,
        message: [service ? `${t('Prestation', 'Service')}: ${service}` : null, message || t('Demande de devis personnalisée.', 'Personalised quote request.')]
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

  if (submitted) {
    return (
      <Motion.div 
        className="success-message glass-dark"
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <CheckCircle2 size={48} className="text-gold" style={{ margin: '0 auto' }} />
        <h3>{t('Demande envoyée !', 'Request sent!')}</h3>
        <p>{t('Nous avons bien reçu votre demande. Notre équipe vous recontactera sous 24 h via WhatsApp ou e-mail.', 'We have received your request. Our team will get back to you within 24 hours via WhatsApp or email.')}</p>
        <button className="btn btn-secondary" onClick={startAnotherRequest}>
          {t('Faire une autre demande', 'Make another request')}
        </button>
      </Motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-describedby={error ? `${formId}-error` : undefined}>
      <input name="website" type="text" tabIndex="-1" autoComplete="off" aria-hidden="true" style={{ display: 'none' }} />
      <div className="form-row">
        <div>
          <label className="sr-only" htmlFor={`${formId}-name`}>{t('Nom complet', 'Full name')}</label>
          <input id={`${formId}-name`} autoComplete="name" name="name" type="text" placeholder={t('Nom complet *', 'Full name *')} required className="form-input devis-form-input" onChange={() => clearFieldError('name')} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? `${formId}-name-error` : undefined} />
          {fieldErrors.name && <p id={`${formId}-name-error`} className="form-field-error" role="alert">{fieldErrors.name}</p>}
        </div>
        <div>
          <label className="sr-only" htmlFor={`${formId}-phone`}>{t('Téléphone / WhatsApp', 'Phone / WhatsApp')}</label>
          <input id={`${formId}-phone`} autoComplete="tel" name="phone" type="tel" inputMode="tel" placeholder={t('Ex. : 640 70 32 49 *', 'E.g. 640 70 32 49 *')} required className="form-input devis-form-input" onChange={() => clearFieldError('phone')} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? `${formId}-phone-error` : undefined} />
          {fieldErrors.phone && <p id={`${formId}-phone-error`} className="form-field-error" role="alert">{fieldErrors.phone}</p>}
        </div>
      </div>
      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
        <label className="sr-only" htmlFor={`${formId}-email`}>{t('Adresse e-mail', 'Email address')}</label>
        <div>
          <input id={`${formId}-email`} autoComplete="email" name="email" type="email" inputMode="email" placeholder="Email" className="form-input devis-form-input" onChange={() => clearFieldError('email')} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${formId}-email-error` : undefined} />
          {fieldErrors.email && <p id={`${formId}-email-error`} className="form-field-error" role="alert">{fieldErrors.email}</p>}
        </div>
      </div>
      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
        <label className="sr-only" htmlFor={`${formId}-service`}>{context}</label>
        <select id={`${formId}-service`} name="service" required className="form-input devis-form-input" style={{ cursor: 'pointer' }} defaultValue="" onChange={() => clearFieldError('service')} aria-invalid={Boolean(fieldErrors.service)} aria-describedby={fieldErrors.service ? `${formId}-service-error` : undefined}>
          <option value="" disabled hidden>{context}</option>
          {options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
        </select>
        {fieldErrors.service && <p id={`${formId}-service-error`} className="form-field-error" role="alert">{fieldErrors.service}</p>}
      </div>
      <div className="form-row" style={{ gridTemplateColumns: '1fr' }}>
        <label className="sr-only" htmlFor={`${formId}-message`}>{t('Description détaillée du besoin', 'Detailed description of your needs')}</label>
        <textarea id={`${formId}-message`} name="message" placeholder={t('Décrivez votre besoin en détail : formats, quantités, délais et budget indicatif.', 'Describe your needs in detail: formats, quantities, timeline and indicative budget.')} required minLength={10} rows="4" className="form-input devis-form-input" style={{ resize: 'vertical' }} onChange={() => clearFieldError('message')} aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? `${formId}-message-error` : undefined}></textarea>
        {fieldErrors.message && <p id={`${formId}-message-error`} className="form-field-error" role="alert">{fieldErrors.message}</p>}
      </div>
      <TransactionalWhatsAppConsent id={`${formId}-whatsapp-consent`} label={t('J’accepte de recevoir sur WhatsApp uniquement les informations transactionnelles liées à cette demande. Optionnel.', 'I agree to receive only transactional information about this request on WhatsApp. Optional.')} help={t('Si cette option est cochée, le numéro de téléphone doit rester joignable sur WhatsApp.', 'If selected, the phone number must be reachable on WhatsApp.')} errorId={fieldErrors.phone ? `${formId}-phone-error` : undefined} />
      {error && <p id={`${formId}-error`} role="alert" style={{ color: '#FED7D7', marginTop: '1rem', fontWeight: 700, textAlign: 'center' }}>{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={submitting}>
        <Send size={18} />
        {submitting ? t('Envoi en cours...', 'Sending...') : t('Envoyer ma demande de devis', 'Send my quote request')}
      </button>
    </form>
  );
};

const Services = () => {
  const { locale } = useLocale();
  const t = (fr, en) => locale === 'en' ? en : fr;
  const [activeTab, setActiveTab] = useState('shooting');
  const [shootingFilter, setShootingFilter] = useState('all');
  const [packages, setPackages] = useState([]);
  const [packagesError, setPackagesError] = useState('');
  const [packagesLoading, setPackagesLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getPackages()
      .then((items) => {
        if (isMounted) setPackages(items.map((item) => packageView(item, locale)));
      })
      .catch(() => {
        if (isMounted) setPackagesError(locale === 'en' ? 'Unable to load pricing from the server.' : 'Impossible de charger les tarifs depuis le serveur.');
      })
      .finally(() => {
        if (isMounted) {
          setPackagesLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [locale]);

  const filteredPacks = shootingFilter === 'all'
    ? packages
    : packages.filter(p => p.cat === shootingFilter);

  const tabs = [
    { key: 'shooting', label: t('Séances photo', 'Photography sessions'), icon: Camera },
    { key: 'design', label: t('Services de design', 'Design services'), icon: Palette },
    { key: 'print', label: t('Impression et produits', 'Printing & products'), icon: Printer },
  ];

  return (
    <div className="services-page">
      {/* Hero Section */}
      <section className="services-hero" aria-labelledby="services-title">
        <div className="services-hero__bg" />
        <div className="container services-hero__content">
          <Motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="home-section-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} /> {t('Prestations', 'Services')}
            </p>
            <h1 id="services-title" className="hero-title">
              {t('Nos', 'Our')} <span className="text-gold">{t('Services', 'services')}</span> & {t('Tarifs', 'pricing')}
            </h1>
            <p className="services-hero__lead">
              {t("Du shooting photo à l’impression, en passant par le design graphique — Golden Studio Plus vous accompagne de A à Z.", 'From photography shoots and printing to graphic design, Golden Studio Plus supports you from start to finish.')}
            </p>
          </Motion.div>
        </div>
      </section>

      <div className="container">
        {/* Tabs Navigation */}
        <div className="services-tabs-container">
          <div className="services-tabs glass" role="tablist" aria-label={t('Catégories de services', 'Service categories')}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  id={`services-tab-${tab.key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`services-panel-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={activeTab === tab.key ? 'active' : ''}
                >
                  {activeTab === tab.key && (
                    <Motion.div
                      layoutId="tab-indicator"
                      className="tab-indicator"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ minHeight: '60vh', paddingBottom: '4rem' }}>
          <AnimatePresence mode="wait">
            <Motion.div
              key={activeTab}
              id={`services-panel-${activeTab}`}
              role="tabpanel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              {/* === TAB: SHOOTING === */}
              {activeTab === 'shooting' && (
                <div>
                  <div className="flex justify-center gap-4 mb-8" style={{ flexWrap: 'wrap' }}>
                    {shootingCategoriesForLocale(locale).map(cat => (
                      <button
                        key={cat.key}
                        className={`btn ${shootingFilter === cat.key ? 'btn-primary' : 'btn-secondary glass'}`}
                        onClick={() => setShootingFilter(cat.key)}
                        style={{ fontSize: '0.8rem', padding: '0.6rem 1.25rem', color: shootingFilter === cat.key ? '#fff' : 'var(--c-forest-dark)' }}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {packagesLoading && (
                    <p className="text-center" style={{ color: 'var(--c-text-muted)', marginBottom: '4rem' }}>{t('Chargement des packs...', 'Loading packages...')}</p>
                  )}
                  {packagesError && (
                    <p className="text-center" style={{ color: '#C53030', marginBottom: '4rem' }}>{packagesError}</p>
                  )}

                  <Motion.div className="pack-grid" variants={staggerContainer} initial="initial" animate="animate">
                    {filteredPacks.map(pack => (
                      <Motion.div key={pack.id} className="pack-card-premium" variants={fadeIn}>
                        {pack.isPromo && <div className="promo-badge">PROMO</div>}
                        
                        <span className="category-label">
                          {shootingCategoriesForLocale(locale).find(c => c.key === pack.cat)?.label}
                        </span>
                        
                        <h3>{pack.name}</h3>
                        <p className="price">{pack.priceLabel}</p>
                        {pack.description && <p>{pack.description}</p>}
                        
                        <ul>
                          <li>
                            <Clock3 size={16} className="text-gold" style={{ marginTop: '3px', flexShrink: 0 }} /> 
                            <span>{t('Durée :', 'Duration:')} {pack.durationLabel}</span>
                          </li>
                          <li>
                            <Images size={16} className="text-gold" style={{ marginTop: '3px', flexShrink: 0 }} /> 
                            <span>{t('Livraison :', 'Delivery:')} {pack.deliveryLabel}</span>
                          </li>
                          {pack.options?.makeupOption && (
                            <li>
                              <Sparkles size={16} className="text-gold" style={{ marginTop: '3px', flexShrink: 0 }} />
                              <span>{pack.options.makeupOption.label} {t('en option :', 'optional:')} {formatFcfa(pack.options.makeupOption.price)}</span>
                            </li>
                          )}
                          {pack.options?.additionalInformation && (
                            <li>
                              <Sparkles size={16} className="text-gold" style={{ marginTop: '3px', flexShrink: 0 }} />
                              <span>{pack.options.additionalInformation}</span>
                            </li>
                          )}
                          {pack.conditions && (
                            <li>
                              <MessageCircle size={16} className="text-gold" style={{ marginTop: '3px', flexShrink: 0 }} aria-hidden="true" />
                              <span>{pack.conditions}</span>
                            </li>
                          )}
                          {pack.note && (
                            <li>
                              <Sparkles size={16} className="text-gold" style={{ marginTop: '3px', flexShrink: 0 }} /> 
                              <span>{pack.note}</span>
                            </li>
                          )}
                        </ul>
                        
                        <div style={{ marginTop: 'auto' }}>
                          {pack.isDirectBooking ? (
                            <Link to={`/reservation?pack=${pack.id}`} className="btn btn-primary pack-cta">
                              {packageCtaLabel(pack, locale)}
                            </Link>
                          ) : (
                            <Link to="/contact" className="btn btn-primary pack-cta">
                              {packageCtaLabel(pack, locale)}
                            </Link>
                          )}
                        </div>
                      </Motion.div>
                    ))}
                  </Motion.div>

                  <section aria-labelledby="catalogue-promotions-title" style={{ margin: '4rem 0' }}>
                    <h2 id="catalogue-promotions-title" className="text-center">{t('Autres privilèges Golden', 'Other Golden privileges')}</h2>
                    <p className="text-center" style={{ color: 'var(--c-text-muted)', marginBottom: '2rem' }}>
                      {t('Ces avantages sont vérifiés et appliqués avec l’équipe lors de votre échange.', 'These benefits are confirmed and applied with the team during your conversation.')}
                    </p>
                    <div className="pack-grid">
                      {cataloguePromotionsForLocale(locale).map((promotion) => (
                        <article key={promotion.code} className="pack-card-premium">
                          <div className="promo-badge">PROMO</div>
                          <span className="category-label">{t('Privilèges Golden', 'Golden privileges')}</span>
                          <h3>{promotion.name}</h3>
                          <p className="price">{promotion.advantage}</p>
                          <p>{promotion.conditions}</p>
                          <p><strong>{promotion.applicationLabel}</strong></p>
                          <div style={{ marginTop: 'auto' }}>
                            <Link to="/contact" className="btn btn-primary pack-cta">{t('Nous contacter', 'Contact us')}</Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <div className="devis-section">
                    <div className="devis-section__bg" />
                    <div className="devis-section__content">
                      <h2>📋 {t('Prestation sur mesure ?', 'Need a tailored service?')}</h2>
                      <p className="lead">
                        {t('Vous avez un besoin spécifique qui ne correspond pas à nos packs standards ? Demandez un devis personnalisé et nous vous proposerons une offre sur mesure.', 'Do you have a specific need that does not match our standard packages? Request a personalised quote and we will propose a tailored offer.')}
                      </p>
                      <DevisForm
                        formId="photo-quote"
                        context={t('Type de prestation souhaité', 'Desired service type')}
                        options={[
                          t('Shooting personnalisé (studio)', 'Custom studio shoot'),
                          t('Shooting extérieur / en location', 'Outdoor / on-location shoot'),
                          t('Couverture événement spécial', 'Special-event coverage'),
                          t('Corporate Day (équipe entière)', 'Corporate Day (whole team)'),
                          t('Shooting produit / e-commerce', 'Product / e-commerce shoot'),
                          t('Autre prestation photo', 'Other photography service'),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB: DESIGN === */}
              {activeTab === 'design' && (
                <div>
                  <p className="text-center" style={{ color: 'var(--c-text-muted)', maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1.05rem', lineHeight: '1.8' }}>
                    {t("Bien plus qu’un studio photo. Nous vous accompagnons dans la création de vos supports de communication et produits visuels personnalisés.", 'More than a photo studio, we help you create communication materials and personalised visual products.')}
                  </p>

                  <Motion.div className="service-list-grid" variants={staggerContainer} initial="initial" animate="animate">
                    {designServices(locale).map(s => (
                      <Motion.div key={s.id} className="service-list-card" variants={fadeIn}>
                        <div className="icon-wrap">
                          {s.icon}
                        </div>
                        <div className="content">
                          <h3>{s.title}</h3>
                          <p>{s.desc}</p>
                          <span className="price">{s.price}</span>
                        </div>
                      </Motion.div>
                    ))}
                  </Motion.div>

                  <ServiceGallery
                    section="design"
                    title={t('Exemples de design réalisés au studio', 'Design examples created at the studio')}
                    description={t('Retouche, communication, identité visuelle et objets personnalisés : découvrez une sélection organisée de projets Golden Studio Plus.', 'Retouching, communication, visual identity and personalised products: discover a curated selection of Golden Studio Plus projects.')}
                  />

                  <div className="devis-section">
                    <div className="devis-section__bg" />
                    <div className="devis-section__content">
                      <h2>🎨 {t('Demander un devis design', 'Request a design quote')}</h2>
                      <p className="lead">
                        {t('Décrivez votre projet et nous vous proposerons une offre personnalisée adaptée à vos besoins.', 'Describe your project and we will propose a personalised offer tailored to your needs.')}
                      </p>
                      <DevisForm
                        formId="design-quote"
                        context={t('Quel service de design vous intéresse ?', 'Which design service are you interested in?')}
                        options={[
                          t('Retouche & restauration photo', 'Photo retouching & restoration'),
                          t('Conception de flyers / affiches', 'Flyer / poster design'),
                          t('Supports visuels (bâches, roll-ups)', 'Visual materials (banners, roll-ups)'),
                          t('Personnalisation (T-shirts, Mugs...)', 'Personalisation (T-shirts, mugs...)'),
                          t('Autre service design', 'Other design service'),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB: PRINT === */}
              {activeTab === 'print' && (
                <div>
                  <p className="text-center" style={{ color: 'var(--c-text-muted)', maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1.05rem', lineHeight: '1.8' }}>
                    {t("Donnez vie à vos souvenirs et projets grâce à nos services d’impression professionnelle et de produits physiques personnalisés.", 'Bring your memories and projects to life with our professional printing services and personalised physical products.')}
                  </p>

                  <Motion.div className="service-list-grid" variants={staggerContainer} initial="initial" animate="animate">
                    {printServices(locale).map(s => (
                      <Motion.div key={s.id} className="service-list-card" variants={fadeIn}>
                        <div className="icon-wrap">
                          {s.icon}
                        </div>
                        <div className="content">
                          <h3>{s.title}</h3>
                          <p>{s.desc}</p>
                          <span className="price">{s.price}</span>
                        </div>
                      </Motion.div>
                    ))}
                  </Motion.div>

                  <ServiceGallery
                    section="print"
                    title={t('Exemples d’impression et de produits', 'Print and product examples')}
                    description={t('Albums, cadres et tirages : découvrez trois réalisations imprimées et préparées par Golden Studio Plus.', 'Albums, frames and prints: discover three pieces printed and prepared by Golden Studio Plus.')}
                  />

                  <div className="devis-section">
                    <div className="devis-section__bg" />
                    <div className="devis-section__content">
                      <h2>🖨️ {t('Demander un devis impression', 'Request a print quote')}</h2>
                      <p className="lead">
                        {t('Précisez vos besoins en impression (formats, quantités, finitions) et recevez une offre sur mesure.', 'Tell us your printing requirements (formats, quantities and finishes) and receive a tailored offer.')}
                      </p>
                      <DevisForm
                        formId="print-quote"
                        context={t('Quel produit vous intéresse ?', 'Which product are you interested in?')}
                        options={[
                          t('Impression photo (tirages)', 'Photo printing (prints)'),
                          t('Album de mariage / Portfolio', 'Wedding album / portfolio'),
                          t("Poster / Cadre / Tirage d’art", 'Poster / frame / fine-art print'),
                          t("Autre produit d’impression", 'Other print product'),
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Services;
