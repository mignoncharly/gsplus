import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="py-section bg-dark text-center" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="container">
        <h1 className="text-accent" style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
        <h2>Page Introuvable</h2>
        <p className="mb-8" style={{ color: '#ccc', maxWidth: '500px', margin: '0 auto 2rem' }}>
          La page que vous recherchez semble ne plus exister ou a été déplacée. Retournez à l'accueil pour découvrir notre univers.
        </p>
        <Link to="/" className="btn btn-primary">Retour à l'Accueil</Link>
      </div>
    </div>
  );
};

export default NotFound;
