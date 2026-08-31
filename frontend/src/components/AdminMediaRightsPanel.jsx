import { useState } from 'react';
import { AlertTriangle, Trash2, Upload } from 'lucide-react';

import { formatBytes } from '../lib/admin-workflow';
import { mediaUrl, reorderAdminMedia, replaceAdminMedia } from '../lib/api';
import { PORTFOLIO_CATEGORIES } from '../lib/portfolio-media';
import './AdminMediaRightsPanel.css';

const mediaRightsStatus = (item) => {
  if (item.rightsBasis === 'OWNER_APPROVED_CATALOG') return 'Catalogue propriétaire approuvé';
  const latestUsage = item.consentUsages?.[0];
  if (latestUsage?.status === 'ACTIVE') return 'Autorisation active';
  if (latestUsage?.status === 'WITHDRAWN') return 'Autorisation retirée';
  if (latestUsage?.status === 'UNPUBLISHED') return 'Utilisation dépubliée';
  return 'Autorisation non vérifiée';
};

const AdminMediaRightsPanel = ({ media, integrity, adminUser, onCreate, onToggle, onRemove, onArchive, onReorder }) => {
  const owner = adminUser?.role === 'OWNER';
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [moving, setMoving] = useState('');
  const [selected, setSelected] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const activeMedia = media.filter((item) => !item.isArchived);
  const shown = alertsOnly ? activeMedia.filter((item) => (item.integrity?.alerts?.length ?? 0) > 0) : activeMedia;

  const move = async (item, direction) => {
    const index = activeMedia.findIndex((entry) => entry.id === item.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeMedia.length) return;
    const ids = activeMedia.map((entry) => entry.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setMoving(item.id);
    try { await reorderAdminMedia(ids); await onReorder?.(); }
    finally { setMoving(''); }
  };

  const replaceFile = async (item, file) => {
    if (!file) return;
    setMoving(item.id);
    try { await replaceAdminMedia(item.id, file); await onReorder?.(); }
    finally { setMoving(''); }
  };

  const bulkPublication = async (published) => {
    for (const item of activeMedia.filter((item) => selected.includes(item.id) && item.isPublished !== published)) await onToggle(item, 'isPublished');
    setSelected([]);
  };
  const bulkArchive = async () => {
    for (const item of activeMedia.filter((item) => selected.includes(item.id))) await onArchive(item);
    setSelected([]);
  };

  return (
    <>
      <div className="admin-page-header">
        <h1>Gestion du <span>Portfolio</span></h1>
      </div>

      {integrity && (
        <section className="admin-card admin-media-integrity" aria-labelledby="media-integrity-title">
          <h2 id="media-integrity-title">Intégrité des médias</h2>
          {integrity.alerts.length === 0 ? (
            <p>Les {integrity.total} médias sont complets : droits établis, fichiers présents, dimensions connues.</p>
          ) : (
            <>
              <p className="admin-record-hint">
                {integrity.total} média{integrity.total < 2 ? '' : 's'} au total.
                {integrity.liveWithBlocking > 0
                  ? ` ${integrity.liveWithBlocking} publié${integrity.liveWithBlocking < 2 ? '' : 's'} malgré une anomalie bloquante.`
                  : ' Aucun média publié ne porte d’anomalie bloquante.'}
              </p>
              <ul className="admin-media-alert-list">
                {integrity.alerts.map((alert) => (
                  <li key={alert.code}>
                    <span className={`admin-pill ${alert.severity === 'blocking' ? 'pill-failed' : 'admin-pill--count'}`}>
                      {alert.severity === 'blocking' ? 'Bloquant' : 'À corriger'}
                    </span>
                    <strong>{alert.label}</strong>
                    <span>{alert.count} média{alert.count < 2 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
              <label className="admin-check">
                <input type="checkbox" checked={alertsOnly} onChange={(event) => setAlertsOnly(event.target.checked)} />
                {' '}N’afficher que les médias à corriger
              </label>
            </>
          )}
        </section>
      )}

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

      {previewItem && <section className="admin-card" role="dialog" aria-label="Aperçu public"><div className="admin-action-row"><h2>Aperçu avant publication</h2><button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => setPreviewItem(null)}>Fermer</button></div><img src={mediaUrl(previewItem.url)} alt={previewItem.altText || previewItem.title} style={{ width: '100%', maxHeight: '480px', objectFit: 'cover', objectPosition: previewItem.objectPosition || 'center center' }} /><p><strong>{previewItem.title}</strong><br /><small>Rendu et cadrage visibles publiquement après publication.</small></p></section>}
      {selected.length > 0 && <section className="admin-card"><strong>{selected.length} média(s) sélectionné(s)</strong><div className="admin-action-row"><button type="button" className="btn btn-primary admin-sm-btn" disabled={!owner || Boolean(moving)} onClick={() => void bulkPublication(true)}>Publier</button><button type="button" className="btn btn-secondary admin-sm-btn" disabled={!owner || Boolean(moving)} onClick={() => void bulkPublication(false)}>Masquer</button><button type="button" className="btn btn-secondary admin-sm-btn text-danger" disabled={!owner || Boolean(moving)} onClick={() => void bulkArchive()}>Archiver</button><button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => setSelected([])}>Annuler</button></div></section>}
      <div className="grid md:grid-cols-3 gap-6">
        {shown.map((item) => (
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
              <label className="admin-check"><input type="checkbox" checked={selected.includes(item.id)} disabled={!owner || Boolean(moving)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /> Sélectionner</label>
              <p style={{ color: 'var(--dark-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{item.category || 'Sans catégorie'}</p>
              <p style={{ color: 'var(--dark-muted)', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                {item.width && item.height ? item.width + ' × ' + item.height + ' px' : 'Dimensions inconnues'}
              </p>
              <p style={{ color: 'var(--dark-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                Dérivé principal : {formatBytes(item.fileSize)} · aperçu : {formatBytes(item.thumbnailFileSize)}
              </p>
              {item.versions?.length > 0 && <p style={{ color: 'var(--dark-muted)', fontSize: '0.78rem', marginBottom: '1rem' }}>Historique : {item.versions.length} fichier(s) remplacé(s), dernière version archivée le {new Date(item.versions[0].createdAt).toLocaleDateString('fr-CM')}.</p>}
              <p style={{ color: 'var(--dark-secondary)', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                <strong>Base de droits :</strong> {mediaRightsStatus(item)}
              </p>
              <p style={{ color: 'var(--dark-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                Référence de réservation : {item.reservation?.reference || 'Catalogue approuvé — sans réservation client'}
              </p>
              {(item.integrity?.alerts?.length ?? 0) > 0 && (
                <ul className="admin-media-item-alerts">
                  {item.integrity.alerts.map((alert) => (
                    <li key={alert.code} className={alert.severity === 'blocking' ? 'is-blocking' : ''}>
                      <AlertTriangle size={12} aria-hidden="true" />
                      <span><strong>{alert.label}</strong> — {alert.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary admin-sm-btn" onClick={() => setPreviewItem(item)} style={{ flex: 1 }}>Aperçu public</button>
                <button type="button" className="btn btn-secondary admin-sm-btn text-danger" onClick={() => onArchive(item)} disabled={!owner} style={{ flex: 1 }}>Archiver</button>
                <button className="btn btn-secondary admin-sm-btn" onClick={() => onToggle(item, 'isPublished')} disabled={!owner} style={{ flex: 1 }}>
                  {item.isPublished ? 'Masquer' : 'Publier'}
                </button>
                <button className="btn btn-secondary admin-sm-btn" onClick={() => onToggle(item, 'isFeatured')} disabled={!owner} style={{ flex: 1 }}>
                  {item.isFeatured ? 'Standard' : 'Vedette'}
                </button>
                <button className="btn btn-secondary admin-sm-btn" onClick={() => move(item, -1)}
                  disabled={!owner || alertsOnly || Boolean(moving) || activeMedia[0]?.id === item.id}
                  aria-label={`Monter ${item.title}`} style={{ flex: 1 }}>↑</button>
                <button className="btn btn-secondary admin-sm-btn" onClick={() => move(item, 1)}
                  disabled={!owner || alertsOnly || Boolean(moving) || activeMedia[activeMedia.length - 1]?.id === item.id}
                  aria-label={`Descendre ${item.title}`} style={{ flex: 1 }}>↓</button>
                <button className="btn btn-secondary admin-sm-btn text-danger" onClick={() => onRemove(item)} disabled={!owner} style={{ width: '100%', marginTop: '0.5rem' }}>
                  <Trash2 size={12} /> Supprimer
                </button>
                <label className="btn btn-secondary admin-sm-btn" style={{ flex: 1, cursor: owner ? 'pointer' : 'not-allowed' }}>
                  Remplacer
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={!owner || Boolean(moving)} onChange={(event) => { void replaceFile(item, event.target.files?.[0]); event.target.value = ''; }} />
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AdminMediaRightsPanel;
