import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Mail, MapPin, MessageSquareText, Phone, Share2 } from 'lucide-react';
import { safeExternalHttpsUrl } from '../lib/external-links';
import { shareSite } from '../lib/share-site';
import { useLocale } from '../lib/i18n.js';
import './Footer.css';

const configuredSocials = [
  { name: 'Instagram', href: safeExternalHttpsUrl(import.meta.env.VITE_INSTAGRAM_URL) },
  { name: 'Facebook', href: safeExternalHttpsUrl(import.meta.env.VITE_FACEBOOK_URL) },
  { name: 'LinkedIn', href: safeExternalHttpsUrl(import.meta.env.VITE_LINKEDIN_URL) },
].filter((item) => item.href);

const SocialBrandIcon = ({ name }) => {
  const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true };
  if (name === 'Instagram') return <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" /></svg>;
  if (name === 'Facebook') return <svg {...iconProps} fill="currentColor"><path d="M13.8 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.6 1.6-1.6H17V3.8c-.4-.1-1.2-.2-2.2-.2-2.3 0-3.8 1.4-3.8 4V10H8.4v3H11v8h2.8Z" /></svg>;
  return <svg {...iconProps} fill="currentColor"><path d="M6.1 8.4H3.2V21h2.9V8.4ZM4.7 3A1.7 1.7 0 1 0 4.7 6.4 1.7 1.7 0 0 0 4.7 3ZM21 13.8c0-3.8-2-5.6-4.7-5.6-2.2 0-3.1 1.2-3.7 2v-1.8H9.7V21h2.9v-6.2c0-1.6.3-3.1 2.3-3.1 2 0 2 1.8 2 3.2V21H21v-7.2Z" /></svg>;
};

const Footer = () => {
  const { t } = useLocale();
  const [shareStatus, setShareStatus] = useState('');

  const handleShare = async () => {
    const result = await shareSite({ navigatorRef: window.navigator, documentRef: window.document, locationRef: window.location });
    if (result.status === 'shared') setShareStatus(t('shared'));
    else if (result.status === 'copied') setShareStatus(t('copied'));
    else if (result.status === 'failed') setShareStatus(t('copyFailed'));
    else setShareStatus('');
  };

  return (
    <footer className="footer bg-dark">
      <div className="container footer-grid">
        <div className="footer-col branding">
          <Link to="/" className="footer-brand-link" aria-label={`Golden Studio Plus — ${t('home')}`}>
            <img src="/images/optimized/brand-logo-160.webp" srcSet="/images/optimized/brand-logo-160.webp 160w, /images/optimized/brand-logo-320.webp 320w" sizes="160px" width="160" height="160" alt="" className="footer-logo" loading="lazy" decoding="async" />
          </Link>
          <p className="footer-tagline">{t('footerTagline')}</p>

          <div className="footer-actions">
            <div className="footer-shortcuts" aria-label={t('footerContact')}>
              <a href="https://wa.me/237673026654" target="_blank" rel="noopener noreferrer" aria-label={t('footerWhatsapp')}>
                <img src="/images/whatsapp-mark-white.svg" className="footer-brand-icon" width="20" height="20" alt="" aria-hidden="true" />
              </a>
              <a href="mailto:info@gsplus.vip" aria-label={t('footerEmail')}><Mail size={20} aria-hidden="true" /></a>
            </div>

            <div className="footer-shortcuts" aria-label={t('footerActions')}>
              <Link to="/portfolio" aria-label={t('footerPortfolio')}><Camera size={20} aria-hidden="true" /></Link>
              <Link to="/services-creatifs#devis-creatif" aria-label={t('footerQuote')}><MessageSquareText size={20} aria-hidden="true" /></Link>
              <button type="button" onClick={handleShare} aria-label={t('footerShare')}><Share2 size={20} aria-hidden="true" /></button>
            </div>

            {configuredSocials.length > 0 && (
              <div className="footer-shortcuts" aria-label={t('footerSocial')}>
                {configuredSocials.map(({ name, href }) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${t('footerFollow')} ${name}`}><SocialBrandIcon name={name} /></a>)}
              </div>
            )}
          </div>
          <p className="footer-share-status" role="status" aria-live="polite">{shareStatus}</p>
        </div>

        <div className="footer-col">
          <h2>{t('footerExplore')}</h2>
          <ul>
            <li><Link to="/">{t('home')}</Link></li>
            <li><Link to="/a-propos">{t('about')}</Link></li>
            <li><Link to="/services">{t('servicesPricing')}</Link></li>
            <li><Link to="/portfolio">{t('portfolio')}</Link></li>
            <li><Link to="/corporate">{t('b2bOffers')}</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h2>{t('contact')}</h2>
          <ul className="contact-list">
            <li><MapPin size={18} className="text-gold" aria-hidden="true" /><span>Douala, Cité des palmiers</span></li>
            <li><Phone size={18} className="text-gold" aria-hidden="true" /><a href="tel:+237673026654">+237 673 026 654</a></li>
            <li><Mail size={18} className="text-gold" aria-hidden="true" /><a href="mailto:info@gsplus.vip">info@gsplus.vip</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h2>{t('legal')}</h2>
          <ul className="legal-links">
            <li><Link to="/cgv">{t('terms')}</Link></li>
            <li><Link to="/confidentialite">{t('privacy')}</Link></li>
            <li><Link to="/mentions-legales">{t('legalNotice')}</Link></li>
            <li><Link to="/admin" className="admin-link">{t('adminArea')}</Link></li>
          </ul>
        </div>
      </div>

      <div className="container">
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Golden Studio Plus. {t('allRightsReserved')}</p>
          <div className="footer-bottom-links"><span>{t('designBy')} <span className="text-gold">Afro-Luxe Moderne</span></span></div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
