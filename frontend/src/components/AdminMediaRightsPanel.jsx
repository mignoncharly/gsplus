import { Trash2, Upload } from 'lucide-react';

import { formatBytes } from '../lib/admin-workflow';
import { mediaUrl } from '../lib/api';
import { PORTFOLIO_CATEGORIES } from '../lib/portfolio-media';

const mediaRightsStatus = (item) => {
  if (item.rightsBasis === 'OWNER_APPROVED_CATALOG') return 'Catalogue propriétaire approuvé';
  const latestUsage = item.consentUsages?.[0];
  if (latestUsage?.status === 'ACTIVE') return 'Autorisation active';
  if (latestUsage?.status === 'WITHDRAWN') return 'Autorisation retirée';
  if (latestUsage?.status === 'UNPUBLISHED') return 'Utilisation dépubliée';
  return 'Autorisation non vérifiée';
};

const AdminMediaRightsPanel = ({ media, adminUser, onCreate, onToggle, onRemove }) => {
  const owner = adminUser?.role === 'OWNER';

  return (
    <>
      <div className="admin-page-header">
        <h1>Gestion du <span>Portfolio</span></h1>
      </div>

      <div className="admin-card" style={{ marginBottom: '2.5rem' }}>
        <h2>Ajouter un Média</h2>
        <p className="admin-modal-info">
          Chaque média client doit être relié à sa réservation. La publication reste bloquée sans autorisation active couvrant le site web.
        </p>
        <form onSubmit={onCreate} className="admin-form-grid portfolio-form-grid" style={{ gap: '1.5rem 1.5rem' }}>
          <div>
            <label htmlFor="portfolio-title" style={{ display: 'block', marginBottom: '0.5rem' }}>Titre *</label>
            <input id="portfolio-title" autoComplete="off" name="title" placeholder="Ex: Portrait Studio Luxe" required className="form-input" disabled={!owner} />
          </div>
          <div>
            <label htmlFor="portfolio-reservation-reference" style={{ display: 'block', marginBottom: '0.5rem' }}>Référence de réservation *</label>
            <input id="portfolio-reservation-reference" autoComplete="off" name="reservationReference" placeholder="GSP-…" required className="form-input" disabled={!owner} />
          </div>
          <div>
            <label htmlFor="portfolio-file" style={{ display: 'block', marginBottom: '0.5rem' }}>Fichier Image *</label>
            <input id="portfolio-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="form-input" style={{ paddingTop: '0.6rem' }} disabled={!owner} />
          </div>
          <div>
            <label htmlFor="portfolio-alt" style={{ display: 'block', marginBottom: '0.5rem' }}>Texte alternatif *</label>
            <input id="portfolio-alt" autoComplete="off" name="altText" placeholder="Décrire précisément le sujet de la photo" className="form-input" required disabled={!owner} />
          </div>
          <div>
            <label htmlFor="portfolio-category" style={{ display: 'block', marginBottom: '0.5rem' }}>Catégorie *</label>
            <select id="portfolio-category" name="category" className="form-input" required defaultValue="" disabled={!owner}>
              <option value="" disabled>Choisir une catégorie éditoriale</option>
              {PORTFOLIO_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="portfolio-position" style={{ display: 'block', marginBottom: '0.5rem' }}>Position de l'image (CSS)</label>
            <input id="portfolio-position" autoComplete="off" name="objectPosition" placeholder="Ex: center top, center center" className="form-input" defaultValue="center top" disabled={!owner} />
          </div>
          <div>
            <label htmlFor="portfolio-sort-order" style={{ display: 'block', marginBottom: '0.5rem' }}>Ordre d’affichage</label>
            <input id="portfolio-sort-order" name="sortOrder" type="number" min="0" step="1" defaultValue="0" className="form-input" disabled={!owner} />
          </div>
          <div style={{ display: 'flex', gap: '2rem', paddingBottom: '0.5rem' }}>
            <label htmlFor="portfolio-featured" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: owner ? 'pointer' : 'not-allowed' }}>
              <input id="portfolio-featured" name="isFeatured" type="checkbox" disabled={!owner} />
              <span>Mis en avant</span>
            </label>
            <label htmlFor="portfolio-published" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: owner ? 'pointer' : 'not-allowed' }}>
              <input id="portfolio-published" name="isPublished" type="checkbox" disabled={!owner} />
              <span>Publier directement</span>
            </label>
          </div>
          <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', padding: '1rem' }} disabled={!owner}>
            <Upload size={18} /> Téléverser l'image dans la Galerie
          </button>
        </form>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {media.map((item) => (
          <div key={item.id} className="admin-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <img
              src={mediaUrl(item.thumbnailUrl || item.url)}
              width={item.thumbnailWidth || item.width}
              height={item.thumbnailHeight || item.height}
              alt={item.altText || item.title}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: '180px', objectFit: 'cover', objectPosition: item.objectPosition || 'center center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
            />
            <div style={{ padding: '1.5rem' }}>
              <strong style={{ color: '#fff', fontSize: '1.05rem', display: 'block', marginBottom: '0.25rem' }}>{item.title}</strong>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{item.category || 'Sans catégorie'}</p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                {item.width && item.height ? item.width + ' × ' + item.height + ' px' : 'Dimensions inconnues'}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                Dérivé principal : {formatBytes(item.fileSize)} · aperçu : {formatBytes(item.thumbnailFileSize)}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                <strong>Base de droits :</strong> {mediaRightsStatus(item)}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Référence de réservation : {item.reservation?.reference || 'Catalogue approuvé — sans réservation client'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary admin-sm-btn" onClick={() => onToggle(item, 'isPublished')} disabled={!owner} style={{ flex: 1 }}>
                  {item.isPublished ? 'Masquer' : 'Publier'}
                </button>
                <button className="btn btn-secondary admin-sm-btn" onClick={() => onToggle(item, 'isFeatured')} disabled={!owner} style={{ flex: 1 }}>
                  {item.isFeatured ? 'Standard' : 'Vedette'}
                </button>
                <button className="btn btn-secondary admin-sm-btn text-danger" onClick={() => onRemove(item)} disabled={!owner} style={{ width: '100%', marginTop: '0.5rem' }}>
                  <Trash2 size={12} /> Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AdminMediaRightsPanel;
