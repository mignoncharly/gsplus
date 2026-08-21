import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import Link from './LocalizedLink.jsx';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../lib/i18n.js';
import { baseRoutePath } from '../lib/locale-routes.js';
import './Header.css';


const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Header = () => {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const activePath = baseRoutePath(location.pathname);
  const toggleRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const trigger = toggleRef.current;
    const background = [document.getElementById('main-content'), document.querySelector('footer'), document.querySelector('.whatsapp-fab')].filter(Boolean);
    const previousOverflow = document.body.style.overflow;
    document.documentElement.classList.add('mobile-menu-open');
    document.body.classList.add('mobile-menu-open');
    document.body.style.overflow = 'hidden';
    background.forEach((element) => { element.inert = true; element.setAttribute('aria-hidden', 'true'); });
    const focusFrame = window.requestAnimationFrame(() => menuRef.current?.querySelector(focusableSelector)?.focus());
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setIsOpen(false); return; }
      if (event.key !== 'Tab' || !menuRef.current) return;
      const focusable = Array.from(menuRef.current.querySelectorAll(focusableSelector));
      if (!focusable.length) return;
      const [first] = focusable;
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.classList.remove('mobile-menu-open');
      document.body.classList.remove('mobile-menu-open');
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => { element.inert = false; element.removeAttribute('aria-hidden'); });
      trigger?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);
  const navLinks = [
    { name: t('home'), path: '/' }, { name: t('about'), path: '/a-propos' }, { name: t('services'), path: '/services' },
    { name: t('portfolio'), path: '/portfolio' }, { name: 'B2B', path: '/corporate' }, { name: t('contact'), path: '/contact' },
  ];

  return (
    <header className={`header ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-content">
        <Link to="/" className="brand-link" onClick={closeMenu} aria-label={`Golden Studio Plus — ${t('home')}`}>
          <img src="/images/optimized/brand-logo-160.webp" srcSet="/images/optimized/brand-logo-160.webp 160w, /images/optimized/brand-logo-320.webp 320w" sizes="160px" width="160" height="160" alt="" className="brand-logo" decoding="async" />
        </Link>
        <nav className="nav-desktop" aria-label={t('navigation')}>
          {navLinks.map((link) => <Link key={link.path} to={link.path} aria-current={activePath === link.path ? 'page' : undefined} className={activePath === link.path ? 'active' : ''} onClick={closeMenu}>{link.name}</Link>)}
          <LanguageSwitcher compact />
          <Link to="/reservation" className="btn btn-primary btn-sm" onClick={closeMenu}>{t('book')}</Link>
        </nav>
        <button ref={toggleRef} type="button" className="mobile-toggle" onClick={() => setIsOpen((open) => !open)} aria-label={isOpen ? t('closeMenu') : t('openMenu')} aria-expanded={isOpen} aria-controls="mobile-navigation-dialog">
          {isOpen ? <X size={28} aria-hidden="true" /> : <Menu size={28} aria-hidden="true" />}
        </button>
        <AnimatePresence>
          {isOpen && <>
            <Motion.div className="mobile-menu-backdrop" aria-hidden="true" onPointerDown={closeMenu} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <Motion.div ref={menuRef} id="mobile-navigation-dialog" className="nav-mobile" role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <div className="nav-mobile-heading">
                <span id="mobile-navigation-title">{t('navigation')}</span>
                <button type="button" className="mobile-menu-close" onClick={closeMenu} aria-label={t('closeMenu')}><X size={24} aria-hidden="true" /></button>
                <LanguageSwitcher compact />
              </div>
              <nav className="nav-mobile-content" aria-label={t('mobileNavigation')}>
                {navLinks.map((link) => <Link key={link.path} to={link.path} aria-current={activePath === link.path ? 'page' : undefined} className={activePath === link.path ? 'active' : ''} onClick={closeMenu}>{link.name}</Link>)}
                <Link to="/reservation" className="btn btn-primary" onClick={closeMenu}>{t('book')}</Link>
              </nav>
            </Motion.div>
          </>}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
