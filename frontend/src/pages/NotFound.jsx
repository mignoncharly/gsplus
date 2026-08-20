import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../lib/i18n.js';

const NotFound = () => {
  const { locale } = useLocale();
  const copy = locale === 'en' ? { title: 'Page not found', text: 'The page you are looking for no longer exists or has moved. Return home to discover our world.', action: 'Back to home' } : { title: 'Page Introuvable', text: 'La page que vous recherchez semble ne plus exister ou a été déplacée. Retournez à l’accueil pour découvrir notre univers.', action: 'Retour à l’Accueil' };
  return <div className="py-section bg-dark text-center" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><div className="container"><h1 className="text-accent" style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1><h2>{copy.title}</h2><p className="mb-8" style={{ color: '#ccc', maxWidth: '500px', margin: '0 auto 2rem' }}>{copy.text}</p><Link to="/" className="btn btn-primary">{copy.action}</Link></div></div>;
};

export default NotFound;
