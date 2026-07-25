import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import './Header.css';

const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const toggleRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const trigger = toggleRef.current;
    const background = [
      document.getElementById('main-content'),
      document.querySelector('footer'),
      document.querySelector('.whatsapp-fab'),
    ].filter(Boolean);
    const previousOverflow = document.body.style.overflow;

    document.documentElement.classList.add('mobile-menu-open');
    document.body.classList.add('mobile-menu-open');
    document.body.style.overflow = 'hidden';
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });

    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector(focusableSelector)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !menuRef.current) return;
      const focusable = Array.from(menuRef.current.querySelectorAll(focusableSelector));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.documentElement.classList.remove('mobile-menu-open');
      document.body.classList.remove('mobile-menu-open');
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => {
        element.inert = false;
        element.removeAttribute('aria-hidden');
      });
      trigger?.focus({ preventScroll: true });
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  const navLinks = [
    { name: 'Accueil', path: '/' },
    { name: 'À propos', path: '/a-propos' },
    { name: 'Services', path: '/services' },
    { name: 'Portfolio', path: '/portfolio' },
    { name: 'B2B', path: '/corporate' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <header className={`header ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="container header-content">
        <Link to="/" className="brand-link" onClick={closeMenu} aria-label="Golden Studio Plus — accueil">
          <img
            src="/images/optimized/brand-logo-160.webp"
            srcSet="/images/optimized/brand-logo-160.webp 160w, /images/optimized/brand-logo-320.webp 320w"
            sizes="160px"
            width="160"
            height="160"
            alt=""
            className="brand-logo"
            decoding="async"
          />
        </Link>

        <nav className="nav-desktop" aria-label="Navigation principale">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              aria-current={location.pathname === link.path ? 'page' : undefined}
              className={location.pathname === link.path ? 'active' : ''}
              onClick={closeMenu}
            >
              {link.name}
            </Link>
          ))}
          <Link to="/reservation" className="btn btn-primary btn-sm" onClick={closeMenu}>
            Réserver
          </Link>
        </nav>

        <button
          ref={toggleRef}
          type="button"
          className="mobile-toggle"
          onClick={() => setIsOpen((open) => !open)}
          aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={isOpen}
          aria-controls="mobile-navigation-dialog"
        >
          {isOpen ? <X size={28} aria-hidden="true" /> : <Menu size={28} aria-hidden="true" />}
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <Motion.div
                className="mobile-menu-backdrop"
                aria-hidden="true"
                onPointerDown={closeMenu}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <Motion.div
                ref={menuRef}
                id="mobile-navigation-dialog"
                className="nav-mobile"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-navigation-title"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <div className="nav-mobile-heading">
                  <span id="mobile-navigation-title">Navigation</span>
                  <button type="button" className="mobile-menu-close" onClick={closeMenu} aria-label="Fermer le menu">
                    <X size={24} aria-hidden="true" />
                  </button>
                </div>
                <nav className="nav-mobile-content" aria-label="Navigation mobile">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      aria-current={location.pathname === link.path ? 'page' : undefined}
                      className={location.pathname === link.path ? 'active' : ''}
                      onClick={closeMenu}
                    >
                      {link.name}
                    </Link>
                  ))}
                  <Link to="/reservation" className="btn btn-primary" onClick={closeMenu}>
                    Réserver
                  </Link>
                </nav>
              </Motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;
