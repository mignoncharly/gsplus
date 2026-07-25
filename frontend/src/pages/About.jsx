import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Crown, ShieldCheck, Sparkles } from 'lucide-react';
import './About.css';

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

const About = () => {
  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero" aria-labelledby="about-title">
        <div className="about-hero__bg" />
        <div className="container about-hero__content">
          <Motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="about-eyebrow">
              <Sparkles size={16} className="text-gold" />
              L'essence du studio
            </p>
            <h1 id="about-title" className="hero-title">
              Notre <span className="text-gold">Histoire</span>
            </h1>
            <p className="about-hero__lead">
              Découvrez la vision, la passion et l'engagement qui animent Golden Studio Plus chaque jour.
            </p>
          </Motion.div>
        </div>
      </section>

      {/* History Section */}
      <section className="about-history py-section">
        <div className="container">
          <div className="history-layout">
            <Motion.div 
              className="history-content"
              initial="initial"
              whileInView="animate"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
            >
              <Motion.p className="home-section-label" variants={fadeIn}>Origines</Motion.p>
              <Motion.h2 variants={fadeIn}>Une passion pour l'excellence visuelle</Motion.h2>
              <Motion.div className="heading-separator" variants={fadeIn}></Motion.div>
              
              <Motion.p variants={fadeIn}>
                Situé au cœur de Douala au Cameroun, Golden Studio Plus est né d'une passion ardente pour l'art visuel et le besoin de capturer l'élégance à l'état pur. Notre mission est d'immortaliser vos instants les plus précieux à travers un objectif professionnel, tout en offrant une expérience "Afro-Luxe" unique en son genre.
              </Motion.p>
              <Motion.p variants={fadeIn}>
                Nous repoussons les limites de la photographie classique pour sublimer vos souvenirs avec une touche divine, en conjuguant créativité, innovation technologique et perfectionnisme. Chaque séance est pensée pour révéler votre éclat naturel et authentique.
              </Motion.p>

              <Motion.div className="history-quote" variants={fadeIn}>
                <p>"Plus que vous ne l'avez imaginé !"</p>
                <span>Notre devise</span>
              </Motion.div>
            </Motion.div>

            <Motion.div 
              className="history-image-wrap"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <img
                src="/images/optimized/about-studio-640.webp"
                srcSet="/images/optimized/about-studio-640.webp 640w, /images/optimized/about-studio-1024.webp 1024w"
                sizes="(max-width: 800px) 100vw, 50vw"
                width="640"
                height="640"
                alt="Séance photo professionnelle au Golden Studio Plus"
                loading="lazy"
                decoding="async"
              />
            </Motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="about-values py-section bg-dark text-on-dark">
        <div className="container">
          <Motion.div 
            className="home-section-heading center"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={fadeIn}
          >
            <p className="home-section-label">Nos engagements</p>
            <h2 style={{ color: '#fff' }}>Pourquoi nous choisir ?</h2>
            <div className="heading-separator" style={{ margin: '1.5rem auto' }}></div>
          </Motion.div>

          <Motion.div 
            className="values-grid"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <Motion.div className="value-card glass-dark" variants={fadeIn}>
              <div className="value-icon">
                <Crown size={32} />
              </div>
              <h3>Excellence</h3>
              <p>Nous livrons des photos en haute définition retouchées avec minutie, pour un rendu impeccable qui traverse le temps.</p>
            </Motion.div>

            <Motion.div className="value-card glass-dark" variants={fadeIn}>
              <div className="value-icon">
                <Sparkles size={32} />
              </div>
              <h3>Cadre Premium</h3>
              <p>Un studio conçu pour votre confort, avec un équipement professionnel.</p>
            </Motion.div>

            <Motion.div className="value-card glass-dark" variants={fadeIn}>
              <div className="value-icon">
                <ShieldCheck size={32} />
              </div>
              <h3>Confidentialité</h3>
              <p>Vos données et vos visuels sont traités conformément aux engagements de confidentialité présentés sur le site.</p>
            </Motion.div>
          </Motion.div>
        </div>
      </section>
    </div>
  );
};

export default About;
