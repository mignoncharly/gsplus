import React from 'react';
import { motion as Motion } from 'framer-motion';
import { LEGAL_LAST_UPDATED } from '../content/legal';
import { useLocale } from '../lib/i18n.js';
import '../pages/LegalPages.css';

const fadeIn = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } };

const LegalPageLayout = ({ icon, title, lastUpdated = LEGAL_LAST_UPDATED, children }) => {
  const { locale } = useLocale();
  const updateLabel = locale === 'en' ? 'Last updated:' : 'Dernière mise à jour :';
  const localizedLastUpdated = locale === 'en' && lastUpdated === '11 août 2026' ? '11 August 2026' : lastUpdated;
  return <div className="legal-page">
    <section className="legal-hero" aria-labelledby="legal-title"><div className="legal-hero__bg" /><div className="container legal-hero__content"><Motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>{React.createElement(icon, { size: 48, className: 'hero-icon', 'aria-hidden': true })}</Motion.div><Motion.h1 id="legal-title" className="hero-title text-gold" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>{title}</Motion.h1><Motion.p className="legal-update-date" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}>{updateLabel} {localizedLastUpdated}</Motion.p></div></section>
    <section className="container"><Motion.div className="legal-content-wrap" variants={fadeIn} initial="initial" animate="animate">{children}</Motion.div></section>
  </div>;
};

export default LegalPageLayout;
