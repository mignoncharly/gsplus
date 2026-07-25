import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, CalendarCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { getPortfolioMedia, mediaUrl } from '../lib/api';
import {
  PORTFOLIO_CATEGORIES,
  curatePortfolioMedia,
  responsiveImageData,
} from '../lib/portfolio-media';
import './Portfolio.css';

const fallbackImage = (id, title, altText, category, slug) => ({
  id,
  title,
  altText,
  category,
  url: `/images/optimized/${slug}-1024.webp`,
  thumbnailUrl: `/images/optimized/${slug}-480.webp`,
  width: 1024,
  height: 1024,
  thumbnailWidth: 480,
  thumbnailHeight: 480,
});

const fallbackPortfolio = [
  fallbackImage('local-portrait-2', 'Portrait studio', 'Portrait féminin réalisé en studio à Douala', 'Portrait', 'portfolio-portrait-2'),
  fallbackImage('local-couple', 'Séance couple', 'Séance photo de couple au Golden Studio Plus', 'Couple', 'portfolio-couple'),
  fallbackImage('local-maternity', 'Maternité', 'Portrait de maternité réalisé en studio à Douala', 'Maternité', 'portfolio-maternity'),
  fallbackImage('local-corporate', 'Portrait corporate', 'Portrait corporate professionnel réalisé à Douala', 'Corporate', 'portfolio-corporate'),
  fallbackImage('local-portrait-3', 'Portrait éditorial', 'Portrait éditorial réalisé au Golden Studio Plus', 'Portrait', 'portfolio-portrait-3'),
  fallbackImage('local-portrait-1', 'Portrait créatif', 'Portrait créatif en lumière de studio', 'Portrait', 'portfolio-portrait-1'),
];

const Portfolio = () => {
  const [filter, setFilter] = useState('Tous');
  const [lightboxImg, setLightboxImg] = useState(null);
  const [portfolioItems, setPortfolioItems] = useState(() => curatePortfolioMedia([], fallbackPortfolio));
  const [loadError, setLoadError] = useState('');
  const lightboxTriggerRef = useRef(null);
  const lightboxCloseRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    getPortfolioMedia()
      .then((items) => {
        if (!isMounted) return;
        setPortfolioItems(curatePortfolioMedia(items, fallbackPortfolio));
        setLoadError('');
      })
      .catch(() => {
        if (isMounted) setLoadError('Portfolio API indisponible. Images locales affichées.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = [
    'Tous',
    ...PORTFOLIO_CATEGORIES.filter((category) =>
      portfolioItems.some((item) => item.category === category)),
  ];
  const filtered = filter === 'Tous' ? portfolioItems : portfolioItems.filter((img) => img.category === filter);

  useEffect(() => {
    if (!lightboxImg) return undefined;

    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setLightboxImg(null);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      lightboxTriggerRef.current?.focus({ preventScroll: true });
    };
  }, [lightboxImg]);

  return (
    <div className="portfolio-page">
      <section className="portfolio-hero" aria-labelledby="portfolio-title">
        <div className="portfolio-hero__bg" />
        <div className="container portfolio-hero__content">
          <Motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p className="home-section-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} /> Nos réalisations
            </p>
            <h1 id="portfolio-title" className="hero-title">
              Notre <span className="text-gold">Portfolio</span>
            </h1>
            <p className="portfolio-hero__lead">
              Découvrez une sélection de nos plus belles captures. Chaque image raconte une histoire unique avec élégance.
            </p>
          </Motion.div>
        </div>
      </section>

      <section className="py-section">
        <div className="container">
          {loadError && <p className="text-center mb-8" style={{ color: 'var(--c-text-muted)' }}>{loadError}</p>}

          <div className="portfolio-filters">
            {categories.map((cat) => (
              <button key={cat} type="button" className={`filter-btn ${filter === cat ? 'active' : ''}`} aria-pressed={filter === cat} onClick={() => setFilter(cat)}>
                {cat}
              </button>
            ))}
          </div>

          <Motion.div className="portfolio-grid" layout>
            <AnimatePresence>
              {filtered.map((img) => {
                const image = responsiveImageData(img, mediaUrl);
                return (
                  <Motion.button
                    key={img.id}
                    type="button"
                    className="portfolio-item"
                    aria-label={`Agrandir ${img.title || img.category || 'cette image'}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4 }}
                    onClick={(event) => { lightboxTriggerRef.current = event.currentTarget; setLightboxImg(img); }}
                  >
                    <img
                      src={image.src}
                      srcSet={image.srcSet}
                      sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                      width={image.width}
                      height={image.height}
                      alt={img.altText}
                      loading="lazy"
                      decoding="async"
                      style={{ objectPosition: img.objectPosition || 'center center' }}
                    />
                    <div className="portfolio-item-overlay">
                      <span className="portfolio-item-category">{img.category}</span>
                    </div>
                  </Motion.button>
                );
              })}
            </AnimatePresence>
          </Motion.div>
        </div>
      </section>

      <AnimatePresence>
        {lightboxImg && (
          <Motion.div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label="Aperçu de la photographie" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <button ref={lightboxCloseRef} type="button" className="lightbox-close" onClick={() => setLightboxImg(null)} aria-label="Fermer l’aperçu">
              <X size={24} />
            </button>

            <div className="lightbox-content">
              <Motion.div className="lightbox-image-wrap" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
                <img
                  src={mediaUrl(lightboxImg.url)}
                  width={lightboxImg.width}
                  height={lightboxImg.height}
                  alt={lightboxImg.altText}
                  decoding="async"
                  style={{ objectPosition: lightboxImg.objectPosition || 'center center' }}
                />
              </Motion.div>

              <Motion.div className="lightbox-actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Link to="/reservation" className="btn btn-primary" onClick={() => setLightboxImg(null)}>
                  <CalendarCheck size={18} />
                  Réserver un Shooting {lightboxImg.category}
                </Link>
              </Motion.div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Portfolio;
