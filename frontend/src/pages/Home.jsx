import { createElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Images,
  Palette,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import { getPackages } from '../lib/api';
import { packageView } from '../lib/packages';
import './Home.css';

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const proofPoints = [
  { value: '48h', label: 'livraison retouchée' },
  { value: '22', label: 'packs studio' },
  { value: '4K', label: 'rendu haute définition' },
];

const servicePaths = [
  {
    icon: Camera,
    title: 'Séances photo',
    text: 'Portraits, familles, maternité et événementiel.',
    image: '/images/optimized/portfolio-portrait-2-1024.webp',
    imageSmall: '/images/optimized/portfolio-portrait-2-480.webp',
    imagePosition: 'center top',
    to: '/services',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Image corporate',
    text: 'Portraits LinkedIn et contenus d’entreprise.',
    image: '/images/optimized/portfolio-corporate-1024.webp',
    imageSmall: '/images/optimized/portfolio-corporate-480.webp',
    imagePosition: 'center top',
    to: '/corporate',
  },
  {
    icon: Palette,
    title: 'Design & impression',
    text: 'Retouches, albums et produits personnalisés.',
    image: '/images/optimized/engagement-1024.webp',
    imageSmall: '/images/optimized/engagement-480.webp',
    imagePosition: 'center top',
    to: '/services-creatifs',
  },
];

const popularPackDetails = {
  'classic-propre': {
    details: ['Portrait individuel', 'Retouche incluse', 'Idéal pour un profil professionnel'],
  },
  'pack-signature': {
    details: ['Direction éditoriale', 'Rendu premium', 'Plus de variations'],
    featured: true,
  },
  'duo-couple': {
    details: ['Séance à deux', 'Guidage des poses', 'Ambiance naturelle'],
  },
};

const popularPackSlugs = [
  'classic-propre',
  'pack-signature',
  'duo-couple',
];


const portfolioPreview = [
  { src: '/images/optimized/portfolio-portrait-2-1024.webp', srcSmall: '/images/optimized/portfolio-portrait-2-480.webp', label: 'Portrait studio', className: 'portfolio-large', objectPosition: 'center top' },
  { src: '/images/optimized/portfolio-couple-1024.webp', srcSmall: '/images/optimized/portfolio-couple-480.webp', label: 'Séance couple', objectPosition: 'center top' },
  { src: '/images/optimized/portfolio-maternity-1024.webp', srcSmall: '/images/optimized/portfolio-maternity-480.webp', label: 'Maternité', objectPosition: 'center top' },
  { src: '/images/optimized/portfolio-corporate-1024.webp', srcSmall: '/images/optimized/portfolio-corporate-480.webp', label: 'Corporate', objectPosition: 'center top' },
];

const testimonials = [
  {
    quote: "Studio hyper pro, j'ai eu mes photos rapidement et la qualité est vraiment au rendez-vous.",
    name: 'Nadège M.',
    context: 'Portrait studio',
  },
  {
    quote: "L'accueil est chaleureux. Le pack Duo était parfait pour nous, avec un résultat très naturel.",
    name: 'Christelle & Paul',
    context: 'Séance couple',
  },
  {
    quote: 'Des portraits corporate magnifiques pour toute notre équipe. Le rendu est propre et cohérent.',
    name: 'Dieudonné K.',
    context: 'Corporate',
  },
];

const Home = () => {
  const [popularPacks, setPopularPacks] = useState([]);

  useEffect(() => {
    let isMounted = true;

    getPackages()
      .then((items) => {
        if (!isMounted) return;
        const normalized = items.map(packageView);
        const selected = popularPackSlugs
          .map((slug) => normalized.find((pack) => pack.slug === slug))
          .filter(Boolean)
          .map((pack) => ({
            ...pack,
            ...(popularPackDetails[pack.slug] || {}),
          }));

        setPopularPacks(selected);
      })
      .catch(() => {
        if (isMounted) {
          setPopularPacks([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <Motion.div 
          className="home-hero__bg"
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        >
          <img
            src="/images/optimized/hero-banner-1024.webp"
            srcSet="/images/optimized/hero-banner-640.webp 640w, /images/optimized/hero-banner-1024.webp 1024w"
            sizes="100vw"
            width="1024"
            height="1024"
            alt="Portrait réalisé en studio par Golden Studio Plus"
            className="home-hero__image"
            fetchPriority="high"
            decoding="async"
          />
          <div className="home-hero__overlay" />
        </Motion.div>

        <div className="container home-hero__content">
          <Motion.div
            className="home-hero__copy"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <p className="home-eyebrow">
              <Sparkles size={16} className="text-gold" />
              L'EXCELLENCE PHOTOGRAPHIQUE À DOUALA
            </p>
            <h1 id="home-hero-title" className="hero-title">
              Révélez votre <span className="text-gold">éclat</span> avec Golden Studio Plus.
            </h1>
            <p className="home-hero__lead">
              Portraits premium, souvenirs d'exception et visuels corporate conçus pour marquer les esprits.
            </p>
            <div className="home-hero__actions">
              <Link to="/reservation" className="btn btn-primary">
                <CalendarCheck size={19} />
                Réserver ma séance
              </Link>
              <Link to="/services" className="btn btn-secondary glass">
                Explorer nos packs
              </Link>
            </div>

            <div className="home-hero__proof">
              {proofPoints.map((item, idx) => (
                <Motion.div 
                  key={item.label} 
                  className="home-proof-item"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 + idx * 0.1 }}
                >
                  <strong className="text-gold">{item.value}</strong>
                  <span>{item.label}</span>
                </Motion.div>
              ))}
            </div>
          </Motion.div>
        </div>
      </section>

      {/* Services Experience Section */}
      <section className="home-section home-services py-section" aria-labelledby="services-title">
        <div className="container">
          <Motion.div 
            className="home-section-heading center"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <p className="home-section-label">Nos Univers</p>
            <h2 id="services-title">Une expérience immersive & guidée</h2>
            <div className="heading-separator"></div>
          </Motion.div>

          <Motion.div 
            className="home-service-grid"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {servicePaths.map(({ icon: Icon, title, text, image, imageSmall, imagePosition, to }) => (
              <Motion.div key={title} variants={fadeIn}>
                <Link className="home-service-card" to={to}>
                  <div
                    className="service-card__image-wrap"
                    style={{ '--service-image-position': imagePosition }}
                  >
                    <img
                      src={imageSmall}
                      srcSet={`${imageSmall} 480w, ${image} 1024w`}
                      sizes="(max-width: 760px) 100vw, 33vw"
                      width="480"
                      height="480"
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="service-card__overlay" />
                  </div>
                  <div className="home-service-card__content">
                    <div className="service-card__heading">
                      <div className="service-card__icon">
                        {createElement(Icon, { size: 24, 'aria-hidden': true })}
                      </div>
                      <h3>{title}</h3>
                    </div>
                    <div className="service-card__text">
                      <p>{text}</p>
                    </div>
                    <div className="service-card__arrow">
                      <ArrowRight size={20} />
                    </div>
                  </div>
                </Link>
              </Motion.div>
            ))}
          </Motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="home-section home-packs py-section bg-cream" aria-labelledby="packs-title">
        <div className="container">
          <Motion.div 
            className="home-section-heading center"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <p className="home-section-label">Offres du Moment</p>
            <h2 id="packs-title">Packs Signature</h2>
          </Motion.div>

          <Motion.div 
            className="home-pack-grid"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {popularPacks.map((pack) => (
              <Motion.article 
                className={`home-pack-card ${pack.featured ? 'is-featured' : ''} glass`} 
                key={pack.id}
                variants={fadeIn}
              >
                {pack.featured && <div className="home-pack-badge">Incontournable</div>}
                <div className="pack-card__header">
                  <h3>{pack.name}</h3>
                  <div className="home-pack-price">{pack.priceLabel}</div>
                </div>
                <div className="home-pack-meta">
                  <span><Clock3 size={16} className="text-gold" /> {pack.durationLabel}</span>
                  <span><Images size={16} className="text-gold" /> Livraison sous {pack.deliveryLabel}</span>
                </div>
                <ul className="pack-features">
                  {pack.details.map((detail) => (
                    <li key={detail}>
                      <CheckCircle2 size={16} className="text-teal" />
                      {detail}
                    </li>
                  ))}
                </ul>
                <Link to={`/reservation?pack=${pack.id}`} className={`btn pack-cta ${pack.featured ? 'btn-primary' : 'btn-secondary'}`}>
                  Réserver maintenant
                </Link>
              </Motion.article>
            ))}
          </Motion.div>
        </div>
      </section>

      {/* Portfolio Preview */}
      <section className="home-section home-portfolio py-section bg-dark overflow-hidden" aria-labelledby="portfolio-title">
        <div className="container">
          <div className="home-portfolio__layout">
            <Motion.div 
              className="home-portfolio__copy"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <p className="home-section-label text-gold">Portfolio</p>
              <h2 id="portfolio-title">L'art de capturer l'instant</h2>
              <p>
                Chaque séance est une œuvre unique. Nous travaillons la lumière et la composition 
                pour créer des images qui racontent votre histoire avec élégance.
              </p>
              <Link to="/portfolio" className="btn btn-primary">
                Découvrir la galerie
                <ArrowRight size={18} />
              </Link>
            </Motion.div>
            
            <div className="home-portfolio-grid">
              {portfolioPreview.map((item, idx) => (
                <Motion.figure 
                  className={item.className} 
                  key={item.src}
                  style={{ '--portfolio-image-position': item.objectPosition || 'center center' }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.15 }}
                >
                  <img
                    src={item.srcSmall}
                    srcSet={`${item.srcSmall} 480w, ${item.src} 1024w`}
                    sizes="(max-width: 760px) 100vw, 33vw"
                    width="480"
                    height="480"
                    alt={item.label}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption className="glass-dark">{item.label}</figcaption>
                </Motion.figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="home-section home-testimonials py-section" aria-labelledby="testimonials-title">
        <div className="container">
          <Motion.div 
            className="home-section-heading center"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <p className="home-section-label">Témoignages</p>
            <h2 id="testimonials-title">Ils nous ont fait confiance</h2>
          </Motion.div>

          <Motion.div 
            className="home-testimonial-grid"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {testimonials.map((testimonial) => (
              <Motion.article className="testimonial-card glass" key={testimonial.name} variants={fadeIn}>
                <div className="home-stars">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={16} fill="var(--c-gold)" stroke="none" />
                  ))}
                </div>
                <p className="testimonial-quote">"{testimonial.quote}"</p>
                <div className="testimonial-author">
                  <div className="author-info">
                    <strong>{testimonial.name}</strong>
                    <span>{testimonial.context}</span>
                  </div>
                </div>
              </Motion.article>
            ))}
          </Motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="home-final-cta py-section bg-gold">
        <div className="container center">
          <Motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="cta-content"
          >
            <Users size={48} className="cta-icon" />
            <h2>Prêt pour une expérience inoubliable ?</h2>
            <p>Réservez votre créneau en quelques clics et laissez la magie opérer.</p>
            <Link to="/reservation" className="btn glass-dark btn-luxe">
              Démarrer l'aventure
            </Link>
          </Motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;
