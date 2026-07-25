import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, Link as LinkIcon, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { safeExternalHttpsUrl } from '../lib/external-links';
import './Footer.css';


const configuredSocials = [
  { name: 'Instagram', href: safeExternalHttpsUrl(import.meta.env.VITE_INSTAGRAM_URL), icon: Camera },
  { name: 'Facebook', href: safeExternalHttpsUrl(import.meta.env.VITE_FACEBOOK_URL), icon: MessageCircle },
  { name: 'LinkedIn', href: safeExternalHttpsUrl(import.meta.env.VITE_LINKEDIN_URL), icon: LinkIcon },
].filter((item) => item.href);

const Footer = () => {
  return (
    <footer className="footer bg-dark">
      <div className="container footer-grid">
        <div className="footer-col branding">
          <Link to="/" className="footer-brand-link" aria-label="Golden Studio Plus — accueil">
            <img
              src="/images/optimized/brand-logo-160.webp"
              srcSet="/images/optimized/brand-logo-160.webp 160w, /images/optimized/brand-logo-320.webp 320w"
              sizes="160px"
              width="160"
              height="160"
              alt=""
              className="footer-logo"
              loading="lazy"
              decoding="async"
            />
          </Link>
          <p className="footer-tagline">L'art de la lumière, l'excellence de l'image. Studio photo premium au cœur de Douala.</p>
          <div className="footer-shortcuts" aria-label="Contacter et suivre Golden Studio Plus">
            <a href="https://wa.me/237673026654" target="_blank" rel="noopener noreferrer" aria-label="Contacter Golden Studio Plus sur WhatsApp">
              <MessageCircle size={20} aria-hidden="true" />
            </a>
            <a href="mailto:info@gsplus.vip" aria-label="Envoyer un e-mail à Golden Studio Plus">
              <Mail size={20} aria-hidden="true" />
            </a>
            {configuredSocials.map(({ name, href, icon: Icon }) => (
              <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Suivre Golden Studio Plus sur ${name}`}>
                {React.createElement(Icon, { size: 20, 'aria-hidden': true })}
              </a>
            ))}
          </div>
        </div>

        <div className="footer-col">
          <h2>Exploration</h2>
          <ul>
            <li><Link to="/">Accueil</Link></li>
            <li><Link to="/a-propos">À propos</Link></li>
            <li><Link to="/services">Services & Tarifs</Link></li>
            <li><Link to="/portfolio">Portfolio</Link></li>
            <li><Link to="/corporate">Offres B2B</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h2>Contact</h2>
          <ul className="contact-list">
            <li><MapPin size={18} className="text-gold" aria-hidden="true" /><span>Douala, Cité des palmiers</span></li>
            <li><Phone size={18} className="text-gold" aria-hidden="true" /><a href="tel:+237673026654">+237 673 026 654</a></li>
            <li><Mail size={18} className="text-gold" aria-hidden="true" /><a href="mailto:info@gsplus.vip">info@gsplus.vip</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h2>Légal</h2>
          <ul className="legal-links">
            <li><Link to="/cgv">Conditions de Vente</Link></li>
            <li><Link to="/confidentialite">Confidentialité</Link></li>
            <li><Link to="/mentions-legales">Mentions Légales</Link></li>
            <li><Link to="/admin" className="admin-link">Espace Admin</Link></li>
          </ul>
        </div>
      </div>

      <div className="container">
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Golden Studio Plus. Tous droits réservés.</p>
          <div className="footer-bottom-links">
            <span>Design by <span className="text-gold">Afro-Luxe Moderne</span></span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
