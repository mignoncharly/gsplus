import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, CalendarCheck } from 'lucide-react';
import Link from '../components/LocalizedLink.jsx';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { getPortfolioMedia, mediaUrl } from '../lib/api';
import { PORTFOLIO_CATEGORIES, curatePortfolioMedia, responsiveImageData } from '../lib/portfolio-media';
import { useLocale } from '../lib/i18n.js';
import './Portfolio.css';

const fallbackImage = (id, title, altText, category, slug, titleEn, altTextEn, categoryEn) => ({ id, title, altText, category, url: `/images/optimized/${slug}-1024.webp`, thumbnailUrl: `/images/optimized/${slug}-480.webp`, width: 1024, height: 1024, thumbnailWidth: 480, thumbnailHeight: 480, titleEn, altTextEn, categoryEn });
const fallbackPortfolio = [
  fallbackImage('local-portrait-2', 'Portrait studio', 'Portrait féminin réalisé en studio à Douala', 'Portrait', 'portfolio-portrait-2', 'Studio portrait', 'Woman’s portrait photographed in the studio in Douala', 'Portrait'),
  fallbackImage('local-couple', 'Séance couple', 'Séance photo de couple au Golden Studio Plus', 'Couple', 'portfolio-couple', 'Couple session', 'Couple photo session at Golden Studio Plus', 'Couple'),
  fallbackImage('local-maternity', 'Maternité', 'Portrait de maternité réalisé en studio à Douala', 'Maternité', 'portfolio-maternity', 'Maternity', 'Maternity portrait photographed in the studio in Douala', 'Maternity'),
  fallbackImage('local-corporate', 'Portrait corporate', 'Portrait corporate professionnel réalisé à Douala', 'Corporate', 'portfolio-corporate', 'Corporate portrait', 'Professional corporate portrait photographed in Douala', 'Corporate'),
  fallbackImage('local-portrait-3', 'Portrait éditorial', 'Portrait éditorial réalisé au Golden Studio Plus', 'Portrait', 'portfolio-portrait-3', 'Editorial portrait', 'Editorial portrait photographed at Golden Studio Plus', 'Portrait'),
  fallbackImage('local-portrait-1', 'Portrait créatif', 'Portrait créatif en lumière de studio', 'Portrait', 'portfolio-portrait-1', 'Creative portrait', 'Creative portrait in studio lighting', 'Portrait'),
];

const englishCategory = (category) => ({ Maternité: 'Maternity', Famille: 'Family', Événementiel: 'Events' })[category] || category;

const copyFor = (locale) => locale === 'en' ? {
  eyebrow: 'Our work', titlePrefix: 'Our', titleAccent: 'Portfolio', lead: 'Discover a selection of our finest captures. Every image tells a unique story with elegance.', loadError: 'Portfolio API unavailable. Local images are displayed.', galleryHeading: 'Explore our photography', all: 'All', enlarge: 'Enlarge', thisImage: 'this image', preview: 'Photography preview', close: 'Close preview', book: 'Book a',
} : {
  eyebrow: 'Nos réalisations', titlePrefix: 'Notre', titleAccent: 'Portfolio', lead: 'Découvrez une sélection de nos plus belles captures. Chaque image raconte une histoire unique avec élégance.', loadError: 'Portfolio API indisponible. Images locales affichées.', galleryHeading: 'Explorer nos photographies', all: 'Tous', enlarge: 'Agrandir', thisImage: 'cette image', preview: 'Aperçu de la photographie', close: 'Fermer l’aperçu', book: 'Réserver un Shooting',
};

const Portfolio = () => {
  const { locale } = useLocale();
  const copy = copyFor(locale);
  const [filter, setFilter] = useState('Tous');
  const [lightboxImg, setLightboxImg] = useState(null);
  const [portfolioItems, setPortfolioItems] = useState(() => curatePortfolioMedia([], fallbackPortfolio));
  const [loadError, setLoadError] = useState('');
  const lightboxTriggerRef = useRef(null);
  const lightboxCloseRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    getPortfolioMedia().then((items) => {
      if (!isMounted) return;
      setPortfolioItems(curatePortfolioMedia(items, fallbackPortfolio));
      setLoadError('');
    }).catch(() => { if (isMounted) setLoadError(copy.loadError); });
    return () => { isMounted = false; };
  }, [copy.loadError]);

  const localizedPortfolioItems = portfolioItems.map((item) => { if (locale !== 'en') return { ...item, categoryLabel: item.category }; const categoryLabel = item.categoryEn || englishCategory(item.category); const hasEnglishCopy = Boolean(item.titleEn || item.altTextEn); return { ...item, title: item.titleEn || categoryLabel, altText: item.altTextEn || (hasEnglishCopy ? item.altText : `${categoryLabel} photography by Golden Studio Plus in Douala`), categoryLabel }; });
  const categories = [copy.all, ...PORTFOLIO_CATEGORIES.filter((category) => localizedPortfolioItems.some((item) => item.category === category)).map((category) => locale === 'en' ? englishCategory(category) : category)];
  const isAllFilter = filter === 'Tous' || filter === 'All';
  const selectedCategory = locale === 'en' ? PORTFOLIO_CATEGORIES.find((category) => englishCategory(category) === filter) || filter : filter;
  const filtered = isAllFilter ? localizedPortfolioItems : localizedPortfolioItems.filter((img) => img.category === selectedCategory);
  useEffect(() => {
    if (!lightboxImg) return undefined;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => lightboxCloseRef.current?.focus());
    const closeOnEscape = (event) => { if (event.key === 'Escape') setLightboxImg(null); };
    document.body.style.overflow = 'hidden'; document.addEventListener('keydown', closeOnEscape);
    return () => { window.cancelAnimationFrame(focusFrame); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = previousOverflow; lightboxTriggerRef.current?.focus({ preventScroll: true }); };
  }, [lightboxImg]);

  return <div className="portfolio-page">
    <section className="portfolio-hero" aria-labelledby="portfolio-title"><div className="portfolio-hero__bg" /><div className="container portfolio-hero__content"><Motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
      <p className="home-section-label" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}><Sparkles size={16} /> {copy.eyebrow}</p>
      <h1 id="portfolio-title" className="hero-title">{copy.titlePrefix} <span className="text-gold">{copy.titleAccent}</span></h1><p className="portfolio-hero__lead">{copy.lead}</p>
    </Motion.div></div></section>
    <section className="py-section" aria-labelledby="portfolio-gallery-title"><div className="container">
      <h2 id="portfolio-gallery-title" className="portfolio-section-heading">{copy.galleryHeading}</h2>
      {loadError && <p className="text-center mb-8" style={{ color: 'var(--c-text-muted)' }}>{loadError}</p>}
      <div className="portfolio-filters">{categories.map((category) => <button key={category} type="button" className={`filter-btn ${(category === copy.all ? isAllFilter : filter === category) ? 'active' : ''}`} aria-pressed={category === copy.all ? isAllFilter : filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
      <Motion.div className="portfolio-grid" layout><AnimatePresence>{filtered.map((img) => {
        const image = responsiveImageData(img, mediaUrl);
        return <Motion.button key={img.id} type="button" className="portfolio-item" aria-label={`${copy.enlarge} ${img.title || img.categoryLabel || copy.thisImage}`} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.4 }} onClick={(event) => { lightboxTriggerRef.current = event.currentTarget; setLightboxImg(img); }}>
          <img src={image.src} srcSet={image.srcSet} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" width={image.width} height={image.height} alt={img.altText} loading="lazy" decoding="async" style={{ objectPosition: img.objectPosition || 'center center' }} />
          <div className="portfolio-item-overlay"><span className="portfolio-item-category">{img.categoryLabel}</span></div>
        </Motion.button>;
      })}</AnimatePresence></Motion.div>
    </div></section>
    <AnimatePresence>{lightboxImg && <Motion.div className="lightbox-overlay" role="dialog" aria-modal="true" aria-label={copy.preview} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <button ref={lightboxCloseRef} type="button" className="lightbox-close" onClick={() => setLightboxImg(null)} aria-label={copy.close}><X size={24} /></button>
      <div className="lightbox-content"><Motion.div className="lightbox-image-wrap" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}><img src={mediaUrl(lightboxImg.url)} width={lightboxImg.width} height={lightboxImg.height} alt={lightboxImg.altText} decoding="async" style={{ objectPosition: lightboxImg.objectPosition || 'center center' }} /></Motion.div>
      <Motion.div className="lightbox-actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}><Link to="/reservation" className="btn btn-primary" onClick={() => setLightboxImg(null)}><CalendarCheck size={18} />{copy.book} {lightboxImg.categoryLabel || lightboxImg.category}</Link></Motion.div></div>
    </Motion.div>}</AnimatePresence>
  </div>;
};

export default Portfolio;
