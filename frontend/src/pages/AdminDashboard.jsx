import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { 
  Ban, 
  Briefcase, 
  Calendar, 
  DollarSign, 
  Image as ImageIcon, 
  Info, 
  Lock, 
  LogOut, 
  Mail, 
  Trash2, 
  Upload, 
  Users, 
  Activity, 
  Layers, 
  ShieldCheck, 
  FileText,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import {
  createAdminAvailabilityBlock,
  createAdminMedia,
  createAdminPackage,
  deleteAdminAvailabilityBlock,
  deleteAdminMedia,
  deleteAdminPackage,
  duplicateAdminPackage,
  getAdminAvailabilityBlocks,
  getAdminLeads,
  getAdminMe,
  getAdminMedia,
  getAdminNotifications,
  getAdminPackages,
  getAdminReservation,
  getAdminReservations,
  getApiHealth,
  loginAdmin,
  logoutAdmin,
  mediaUrl,
  resolveAdminNotification,
  retryAdminNotification,
  rescheduleAdminReservation,
  syncAdminReservationCalendar,
  updateAdminLead,
  updateAdminMedia,
  updateAdminPackage,
  updateAdminReservation,
  updateAdminAvailabilityBlock,
  verifyAdminPayment,
} from '../lib/api';
import {
  packageReferenceCount,
  reservationActions,
  statusLabel,
  transitionActorLabel,
} from '../lib/admin-workflow';
import { resetFormAfterSuccess } from '../lib/lead-submission';
import {
  businessDateKey,
  businessDateTimeLocalValue,
  currentBusinessMonthKey,
  doualaLocalDateTimeToIso,
  formatBusinessDateTime,
} from '../lib/business-time';
import { PORTFOLIO_CATEGORIES } from '../lib/portfolio-media';
import './AdminDashboard.css';

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'inconnue';
  if (bytes < 1024) return `${bytes} o`;
  return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} Ko`;
};
const currency = (value) => `${Number(value || 0).toLocaleString('fr-FR')} FCFA`;
const dateTime = formatBusinessDateTime;
const monthKey = currentBusinessMonthKey();
const ADMIN_TABS = ['overview', 'reservations', 'leads', 'tarifs', 'availability', 'portfolio', 'notifications'];
const ADMIN_LOADING_STATE = Object.fromEntries(ADMIN_TABS.map((tab) => [tab, true]));

const statusClass = (status) => {
  return `pill-${String(status).toLowerCase()}`;
};

const pill = (status) => (
  <span className={`admin-pill ${statusClass(status)}`}>
    {statusLabel(status)}
  </span>
);

const latestCalendarSync = (reservation) => reservation?.calendarSync || reservation?.calendarSyncLogs?.[0] || null;

const calendarErrorLabel = (code) => ({
  CALENDAR_NOT_CONFIGURED: 'Calendrier externe non configuré',
  CALENDAR_EXTERNAL_EVENT_NOT_FOUND: 'Événement externe introuvable',
  CALENDAR_OPERATION_SUPERSEDED: 'Opération remplacée par un état plus récent',
  CALENDAR_STATUS_NOT_SYNCABLE: 'Statut non synchronisable',
  CALENDAR_PROVIDER_FAILED: 'Échec technique du fournisseur calendrier',
  CALENDAR_LEGACY_PROVIDER_FAILURE: 'Ancien échec fournisseur — détails historiques indisponibles',
  CALENDAR_PROVIDER_ID_MISSING: 'Identifiant fournisseur manquant',
  CALENDAR_EVENT_TYPE_INVALID: 'Type d’événement calendrier invalide',
  CALENDAR_EVENT_TYPE_MISSING: 'Type d’événement calendrier absent',
  CALENDAR_DURATION_UNSUPPORTED: 'Durée non prise en charge par le calendrier',
  CALENDAR_EVENT_TYPE_NOT_FOUND: 'Type d’événement configuré introuvable',
}[code] || code || 'Aucune erreur');

const notificationResolutionLabel = (code) => ({
  OBSOLETE: 'Obsolète — ne pas renvoyer',
  DUPLICATE: 'Doublon',
  PERMANENTLY_FAILED: 'Échec définitif',
  ACTIONABLE_REVIEW_REQUIRED: 'Examen requis avant renvoi',
  REPLACED: 'Remplacée par une autre notification',
}[code] || 'Non classée');

const pageTransition = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
};

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRes, setSelectedRes] = useState(null);
  const [apiStatus, setApiStatus] = useState({ state: 'checking', message: 'Vérification API...' });
  const [feedback, setFeedback] = useState(null);
  const [loadingTabs, setLoadingTabs] = useState({});
  const [busyActions, setBusyActions] = useState({});
  const [editingPack, setEditingPack] = useState(null);
  const [previewPack, setPreviewPack] = useState(null);
  const feedbackRef = useRef(null);

  const [reservations, setReservations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [packs, setPacks] = useState([]);
  const [media, setMedia] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const loadAdminData = async () => {
    setLoadingTabs(ADMIN_LOADING_STATE);
    try {
      const [reservationItems, leadItems, packageItems, mediaItems, blockItems, notificationItems] = await Promise.all([
        getAdminReservations(),
        getAdminLeads(),
        getAdminPackages(),
        getAdminMedia(),
        getAdminAvailabilityBlocks(),
        getAdminNotifications(),
      ]);
      setReservations(reservationItems);
      setLeads(leadItems);
      setPacks(packageItems);
      setMedia(mediaItems);
      setBlocks(blockItems);
      setNotifications(notificationItems);
      return true;
    } catch (err) {
      setFeedback({ tab: activeTab, type: 'error', message: err.message || 'Impossible de charger les données admin.' });
      return false;
    } finally {
      setLoadingTabs({});
    }
  };

  useEffect(() => {
    let isMounted = true;

    getApiHealth()
      .then((data) => {
        if (isMounted) setApiStatus({ state: 'online', message: `API backend : opérationnelle (${data.status})` });
      })
      .catch(() => {
        if (isMounted) setApiStatus({ state: 'offline', message: 'API backend : indisponible' });
      });

    getAdminMe()
      .then((admin) => {
        if (!isMounted) return;
        setAdminUser(admin);
        setIsAuthenticated(true);
        loadAdminData();
      })
      .catch(() => {
        if (isMounted) setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) setAuthChecking(false);
      });

    return () => {
      isMounted = false;
    };
  // Initial session bootstrap only; later refreshes are action-owned.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (feedback && feedback.tab === activeTab) {
      feedbackRef.current?.focus();
    }
  }, [feedback, activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);

    try {
      const admin = await loginAdmin({ email, password });
      setAdminUser(admin);
      setIsAuthenticated(true);
      setEmail('');
      setPassword('');
      await loadAdminData();
    } catch (err) {
      setLoginError(err.message || 'Connexion impossible. Identifiants incorrects.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
    setAdminUser(null);
    setReservations([]);
    setLeads([]);
    setPacks([]);
    setMedia([]);
    setBlocks([]);
    setNotifications([]);
    setFeedback(null);
  };

  const runAction = async (label, action) => {
    const key = `${activeTab}:${label}`;
    setBusyActions((current) => ({ ...current, [key]: true }));
    setFeedback({ tab: activeTab, type: 'progress', message: `${label}...` });
    try {
      await action();
      const reloaded = await loadAdminData();
      if (!reloaded) throw new Error('Action enregistrée, mais les données n’ont pas pu être rechargées.');
      setFeedback({
        tab: activeTab,
        type: 'success',
        message: `${label} terminé avec succès.`,
      });
      return true;
    } catch (err) {
      setFeedback({ tab: activeTab, type: 'error', message: err.message || `Échec de l'action : ${label}` });
      return false;
    } finally {
      setBusyActions((current) => ({ ...current, [key]: false }));
    }
  };

  const openReservation = async (reservation) => {
    const key = `reservations:detail:${reservation.id}`;
    setBusyActions((current) => ({ ...current, [key]: true }));
    try {
      setSelectedRes(await getAdminReservation(reservation.id));
    } catch (err) {
      setFeedback({ tab: 'reservations', type: 'error', message: err.message || 'Détails indisponibles.' });
    } finally {
      setBusyActions((current) => ({ ...current, [key]: false }));
    }
  };

  const updateReservationStatus = async (reservation, status, action = {}) => {
    const needsReason = action.requiresReason || ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(status);
    const reason = needsReason
      ? window.prompt('Veuillez indiquer le motif de cette action administrative :')?.trim()
      : undefined;

    if (needsReason && !reason) {
      setFeedback({ tab: 'reservations', type: 'error', message: 'Action annulée : un motif est obligatoire.' });
      return;
    }

    if (!window.confirm(`Confirmer l’action « ${action.label || statusLabel(status)} » ?`)) return;

    const success = await runAction('Mise à jour de la réservation', async () => {
      await updateAdminReservation(reservation.id, { status, reason });
    });
    if (success) setSelectedRes(await getAdminReservation(reservation.id));
  };

  const updateFirstPayment = async (reservation, status) => {
    const payment = reservation.payments?.[0];
    if (!payment) {
      setFeedback({ tab: 'reservations', type: 'error', message: 'Aucun paiement associé à cette réservation.' });
      return;
    }

    let transactionRef;
    if (status === 'VERIFIED') {
      const entered = window.prompt('Référence de transaction à vérifier :', payment.transactionRef || '');
      if (entered === null) return;
      transactionRef = entered.trim();
      if (!transactionRef) {
        setFeedback({ tab: 'reservations', type: 'error', message: 'La référence de transaction est obligatoire.' });
        return;
      }
    }

    const needsReason = status === 'REJECTED';
    const reason = needsReason
      ? window.prompt('Veuillez indiquer pourquoi ce paiement est rejeté :')?.trim()
      : undefined;

    if (needsReason && !reason) {
      setFeedback({ tab: 'reservations', type: 'error', message: 'Action annulée : un motif est obligatoire.' });
      return;
    }

    if (!window.confirm(`Confirmer l’action « ${statusLabel(status)} » sur ce paiement ?`)) return;

    const success = await runAction('Vérification du paiement', async () => {
      await verifyAdminPayment(payment.id, { status, reason, transactionRef });
    });
    if (success) setSelectedRes(await getAdminReservation(reservation.id));
  };

  const createPackageItem = async () => {
    const name = window.prompt('Nom de la nouvelle formule :')?.trim();
    if (!name) return;
    const slug = window.prompt('Identifiant URL (minuscules et tirets) :')?.trim();
    if (!slug) return;
    const category = window.prompt('Catégorie :')?.trim();
    if (!category) return;
    const price = window.prompt('Prix en FCFA :', '0');
    const durationMin = window.prompt('Durée en minutes :', '60');
    if (price === null || durationMin === null) return;
    if (!window.confirm(`Créer la formule « ${name} » ?`)) return;
    await runAction('Création de la formule', () =>
      createAdminPackage({
        name,
        slug,
        category,
        price: Number(price),
        durationMin: Number(durationMin),
      }),
    );
  };

  const editPackageItem = async (pack) => {
    setEditingPack(pack.id);
    const fields = [
      ['name', 'Nom', pack.name],
      ['slug', 'Identifiant URL', pack.slug],
      ['category', 'Catégorie', pack.category],
      ['description', 'Description', pack.description || ''],
      ['price', 'Prix en FCFA', pack.price],
      ['durationMin', 'Durée en minutes', pack.durationMin],
      ['deliveryLabel', 'Délai de livraison', pack.deliveryLabel || ''],
      ['sortOrder', 'Ordre d’affichage', pack.sortOrder],
      ['legalText', 'Texte légal associé', pack.legalText || ''],
    ];
    const values = {};
    for (const [key, label, initialValue] of fields) {
      const value = window.prompt(`${label} :`, String(initialValue));
      if (value === null) {
        setEditingPack(null);
        return;
      }
      values[key] = value.trim() || null;
    }
    values.price = Number(values.price);
    values.durationMin = Number(values.durationMin);
    values.sortOrder = Number(values.sortOrder);
    if (!window.confirm(`Enregistrer une nouvelle version de « ${values.name} » ?`)) { setEditingPack(null); return; }
    await runAction('Modification de la formule', () => updateAdminPackage(pack.id, values));
    setEditingPack(null);
  };

  const duplicatePackageItem = async (pack) => {
    if (!window.confirm(`Dupliquer la formule « ${pack.name} » ?`)) return;
    await runAction('Duplication de la formule', () => duplicateAdminPackage(pack.id));
  };

  const updatePackageState = async (pack, changes, label) => {
    if (!window.confirm(`${label} « ${pack.name} » ?`)) return;
    await runAction(label, () => updateAdminPackage(pack.id, changes));
  };

  const movePackage = (pack, direction) =>
    updatePackageState(pack, { sortOrder: Math.max(0, pack.sortOrder + direction) }, 'Modification de l’ordre');

  const removePackageItem = async (pack) => {
    const references = packageReferenceCount(pack);
    if (references > 0) {
      setFeedback({ tab: 'tarifs', type: 'error', message: `Suppression interdite : ${references} réservation(s) ou intention(s) utilisent cette formule. Archivez-la.` });
      return;
    }
    if (!window.confirm(`Supprimer définitivement la formule non référencée « ${pack.name} » ?`)) return;
    await runAction('Suppression de la formule', () => deleteAdminPackage(pack.id));
  };

  const updateLeadStatus = (lead, status) => {
    if (!window.confirm(`Passer cette demande au statut « ${statusLabel(status)} » ?`)) return;
    return runAction('Mise à jour de la demande', () => updateAdminLead(lead.id, { status }));
  };

  const classifyNotification = async (item, resolution) => {
    const defaultNote = resolution === 'OBSOLETE'
      ? 'Événement historique devenu sans objet; aucun renvoi autorisé.'
      : 'Événement potentiellement pertinent; examen individuel requis avant tout renvoi.';
    const note = window.prompt('Note obligatoire de classification :', defaultNote)?.trim();
    if (!note) return;
    if (!window.confirm('Enregistrer cette classification sans envoyer de message ?')) return;
    await runAction('Classification notification', () =>
      resolveAdminNotification(item.id, { resolution, note }),
    );
  };

  const retryNotification = async (item) => {
    if (!window.confirm('Réessayer uniquement cette notification ? Aucun autre échec historique ne sera renvoyé.')) return;
    await runAction(`Réessai notification ${item.id}`, () => retryAdminNotification(item.id));
  };

  const syncReservationCalendar = async (reservation) => {
    const success = await runAction('Synchronisation calendrier', () =>
      syncAdminReservationCalendar(reservation.id),
    );
    if (success) setSelectedRes(await getAdminReservation(reservation.id));
  };

  const rescheduleReservationItem = async (reservation) => {
    const entered = window.prompt(
      'Nouveau créneau à Douala (AAAA-MM-JJTHH:mm) :',
      businessDateTimeLocalValue(reservation.startAt),
    );
    if (entered === null) return;
    const reason = window.prompt('Motif obligatoire du déplacement :')?.trim();
    if (!reason) {
      setFeedback({ tab: 'reservations', type: 'error', message: 'Déplacement annulé : un motif est obligatoire.' });
      return;
    }
    let startAt;
    try {
      startAt = doualaLocalDateTimeToIso(entered);
    } catch {
      setFeedback({ tab: 'reservations', type: 'error', message: 'Date ou heure invalide.' });
      return;
    }
    if (!window.confirm(`Déplacer cette réservation au ${dateTime(startAt)} ?`)) return;
    const success = await runAction('Déplacement de la réservation', () =>
      rescheduleAdminReservation(reservation.id, { startAt, reason }),
    );
    if (success) setSelectedRes(await getAdminReservation(reservation.id));
  };

  const createBlock = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startAt = form.get('startAt');
    const endAt = form.get('endAt');
    const success = await runAction('Blocage calendrier', () =>
      createAdminAvailabilityBlock({
        startAt: doualaLocalDateTimeToIso(startAt),
        endAt: doualaLocalDateTimeToIso(endAt),
        reason: form.get('reason') || undefined,
      }),
    );
    resetFormAfterSuccess(formElement, success);
  };

  const editBlock = (block) => {
    const startAt = window.prompt('Début à Douala (AAAA-MM-JJTHH:mm)', businessDateTimeLocalValue(block.startAt));
    if (startAt === null) return;
    const endAt = window.prompt('Fin à Douala (AAAA-MM-JJTHH:mm)', businessDateTimeLocalValue(block.endAt));
    if (endAt === null) return;
    const reason = window.prompt('Raison / motif', block.reason || '');
    if (reason === null) return;

    return runAction('Modification blocage', () =>
      updateAdminAvailabilityBlock(block.id, {
        startAt: doualaLocalDateTimeToIso(startAt),
        endAt: doualaLocalDateTimeToIso(endAt),
        reason: reason || undefined,
      }),
    );
  };

  const createMedia = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const success = await runAction('Upload média', () => createAdminMedia(form));
    resetFormAfterSuccess(formElement, success);
  };

  const toggleMediaFlag = (item, field) =>
    runAction('Mise à jour média', () => updateAdminMedia(item.id, { [field]: !item[field] }));

  const paidRevenueThisMonth = reservations
    .filter((reservation) => reservation.startAt && businessDateKey(new Date(reservation.startAt)).startsWith(monthKey))
    .flatMap((reservation) => reservation.payments || [])
    .filter((payment) => payment.status === 'VERIFIED')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const uniqueCustomers = new Set(reservations.map((reservation) => reservation.customerId)).size;

  if (authChecking) {
    return (
      <div className="admin-login-wrapper">
        <div style={{ color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Clock className="animate-spin text-gold" size={32} />
          <p role="status" aria-live="polite">Vérification de la session en cours...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper">
        <Motion.div 
          className="admin-login-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ background: 'rgba(197, 146, 58, 0.1)', width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: 'var(--c-gold)' }}>
            <Lock size={30} />
          </div>
          <h2>Espace <span>Admin</span></h2>
          <form onSubmit={handleLogin} aria-describedby={loginError ? 'admin-login-error' : undefined}>
            <label htmlFor="admin-email" className="sr-only">Adresse email administrateur</label>
            <input 
              id="admin-email"
              name="email"
              autoComplete="username"
             
              type="email" 
              placeholder="Adresse email administrateur" 
              className="form-input admin-login-input" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <label htmlFor="admin-password" className="sr-only">Mot de passe</label>
            <input 
              id="admin-password"
              name="password"
              autoComplete="current-password"
              type="password" 
              placeholder="Mot de passe" 
              className="form-input admin-login-input" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            {loginError && (
              <p id="admin-login-error" role="alert" style={{ color: '#ff8787', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                {loginError}
              </p>
            )}
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '1rem' }} 
              disabled={loginSubmitting}
            >
              {loginSubmitting ? 'Connexion en cours...' : 'Se Connecter'}
            </button>
            <div style={{ marginTop: '2rem' }}>
              <Link 
                to="/" 
                style={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  fontSize: '0.85rem', 
                  textDecoration: 'none', 
                  transition: 'color 0.3s ease',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  fontWeight: 700
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--c-gold)'}
                onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.4)'}
              >
                ← Retourner au site
              </Link>
            </div>
          </form>
        </Motion.div>
      </div>
    );
  }

  const nav = [
    ['overview', 'Vue ensemble', Calendar],
    ['reservations', 'Réservations', Users],
    ['leads', 'Leads', Briefcase],
    ['tarifs', 'Tarifs', DollarSign],
    ['availability', 'Disponibilités', Ban],
    ['portfolio', 'Portfolio', ImageIcon],
    ['notifications', 'Emails', Mail],
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar navigation */}
      <aside className="admin-sidebar">
        <div className="admin-logo-section">
          <h2>GS<span>+</span> Studio</h2>
          <span className="admin-user-tag">{adminUser?.name || 'Administrateur'}</span>
          <div style={{ marginTop: '0.75rem' }}>
            <Link 
              to="/" 
              style={{ 
                color: 'var(--c-gold)', 
                fontSize: '0.8rem', 
                textDecoration: 'none', 
                fontWeight: 700, 
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--c-gold-light)'}
              onMouseLeave={(e) => e.target.style.color = 'var(--c-gold)'}
            >
              ← Retour au site
            </Link>
          </div>
        </div>

        <nav className="admin-nav-list">
          {nav.map(([key, label, navIcon]) => (
            <button 
              key={key} 
              onClick={() => {
                setFeedback(null);
                setActiveTab(key);
              }} 
              className={`admin-nav-btn ${activeTab === key ? 'active' : ''}`}
            >
              {React.createElement(navIcon, { size: 20 })} {label}
            </button>
          ))}
        </nav>

        <button onClick={handleLogout} className="admin-logout-btn">
          <LogOut size={20} /> Déconnexion
        </button>
      </aside>

      {/* Main dashboard content */}
      <main className="admin-main">
        {feedback?.tab === activeTab && (
          <div
            ref={feedbackRef}
            tabIndex="-1"
            role={feedback.type === 'error' ? 'alert' : 'status'}
            aria-live={feedback.type === 'error' ? 'assertive' : 'polite'}
            className={`admin-status-banner ${feedback.type === 'error' ? 'error' : ''}`}
          >
            <AlertCircle size={20} />
            <span>{feedback.message}</span>
          </div>
        )}

        {loadingTabs[activeTab] && (
          <div className="admin-status-banner" role="status" aria-live="polite">
            <Clock className="animate-spin" size={20} />
            <span>Chargement de cette section...</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <Motion.div 
              key="overview"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Vue <span>d'ensemble</span></h1>
              </div>

              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="admin-stat-icon-wrap"><Calendar size={24} /></div>
                  <div className="admin-stat-num">{reservations.length}</div>
                  <div className="admin-stat-label">Réservations</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon-wrap"><DollarSign size={24} /></div>
                  <div className="admin-stat-num" style={{ fontSize: '1.4rem', whiteSpace: 'nowrap' }}>{currency(paidRevenueThisMonth)}</div>
                  <div className="admin-stat-label">CA vérifié ce mois</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon-wrap"><Users size={24} /></div>
                  <div className="admin-stat-num">{uniqueCustomers}</div>
                  <div className="admin-stat-label">Clients Uniques</div>
                </div>
                <div className="admin-stat-card">
                  <div className="admin-stat-icon-wrap"><Briefcase size={24} /></div>
                  <div className="admin-stat-num">{leads.length}</div>
                  <div className="admin-stat-label">Demandes B2B</div>
                </div>
              </div>

              <div className="admin-card">
                <h2>Statut Système</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <Activity size={18} className={apiStatus.state === 'online' ? 'text-gold' : 'text-danger'} />
                  <p style={{ color: apiStatus.state === 'online' ? '#2ecc71' : '#e74c3c', fontWeight: 600, margin: 0 }}>
                    {apiStatus.message}
                  </p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', margin: 0 }}>
                  Le système contient actuellement {blocks.length} blocage(s) de calendrier, {media.length} média(s) dans la galerie, {packs.length} package(s) tarifaire(s) configuré(s), et {notifications.length} notification(s) envoyée(s).
                </p>
              </div>
            </Motion.div>
          )}

          {activeTab === 'reservations' && (
            <Motion.div 
              key="reservations"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Toutes les <span>Réservations</span></h1>
              </div>

              <div className="admin-card" style={{ padding: '2rem' }}>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date & Heure</th>
                        <th>Client</th>
                        <th>Pack Sélectionné</th>
                        <th>Statut</th>
                        <th>Paiement</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => {
                        const payment = reservation.payments?.[0];
                        return (
                          <tr key={reservation.id}>
                            <td>{dateTime(reservation.startAt)}</td>
                            <td>
                              <strong>{reservation.customer?.firstName} {reservation.customer?.lastName}</strong>
                              <small>{reservation.customer?.phone}</small>
                            </td>
                            <td>{reservation.package?.name}</td>
                            <td>{pill(reservation.status)}</td>
                            <td>{payment ? pill(payment.status) : pill('AUCUN')}</td>
                            <td>
                              <button 
                                className="btn btn-primary admin-sm-btn" 
                                onClick={() => openReservation(reservation)}
                                disabled={Boolean(busyActions[`reservations:detail:${reservation.id}`])}
                              >
                                <Info size={14} /> Détails
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </Motion.div>
          )}

          {activeTab === 'leads' && (
            <Motion.div 
              key="leads"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Demandes <span>B2B / Leads</span></h1>
              </div>

              <div className="admin-card">
                {leads.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
                    Aucune demande B2B reçue pour le moment.
                  </p>
                )}
                {leads.map((lead) => (
                  <div key={lead.id} className="admin-lead-card">
                    <div className="admin-lead-header">
                      <div>
                        <h3>{lead.company || lead.name}</h3>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', margin: 0 }}>
                          {lead.email || 'Pas d\'email'} | {lead.phone || 'Pas de téléphone'}
                        </p>
                      </div>
                      <div className="admin-lead-badges">
                        {pill(lead.type || 'B2B')}
                        {pill(lead.status)}
                      </div>
                    </div>
                    <p style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '1rem' }}>
                      <strong>Sujet :</strong> {lead.subject || lead.source}
                    </p>
                    <div className="admin-lead-message">{lead.message}</div>
                    <div className="admin-action-row">
                      {['IN_PROGRESS', 'WON', 'LOST', 'ARCHIVED'].map((status) => (
                        <button 
                          key={status} 
                          className="btn btn-secondary admin-sm-btn" 
                          onClick={() => updateLeadStatus(lead, status)}
                        >
                          {statusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Motion.div>
          )}

          {activeTab === 'tarifs' && (
            <Motion.div 
              key="tarifs"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Édition des <span>Tarifs</span></h1>
                <button className="btn btn-primary admin-sm-btn" onClick={createPackageItem}>Créer une formule</button>
              </div>

              <div className="admin-card">
                {packs.map((pack) => (
                  <div 
                    key={pack.id} 
                    style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', padding: '1.5rem 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
                  >
                    <div>
                      <strong style={{ color: '#fff', fontSize: '1.05rem' }}>{pack.name}</strong>
                      <small style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginTop: '0.25rem' }}>
                        {pack.category}
                      </small>
                      <small style={{ color: 'rgba(255,255,255,0.55)', display: 'block', marginTop: '0.35rem' }}>
                        {currency(pack.price)} · {pack.durationMin} min · version {pack.version} · ordre {pack.sortOrder}
                      </small>
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>{pill(pack.isArchived ? 'ARCHIVED' : pack.isActive ? 'ACTIVE' : 'INACTIVE')} {pill(`${packageReferenceCount(pack)} référence(s)`)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => setPreviewPack(pack)}>Aperçu</button>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => editPackageItem(pack)} disabled={editingPack === pack.id}>{editingPack === pack.id ? 'Modification...' : 'Modifier'}</button>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => duplicatePackageItem(pack)}>Dupliquer</button>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => movePackage(pack, -1)} aria-label={`Monter ${pack.name}`}>↑</button>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => movePackage(pack, 1)} aria-label={`Descendre ${pack.name}`}>↓</button>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => updatePackageState(pack, { isActive: !pack.isActive, isArchived: false }, pack.isActive ? 'Désactivation' : 'Activation')}>{pack.isActive ? 'Désactiver' : 'Activer'}</button>
                      <button className="btn btn-secondary admin-sm-btn" onClick={() => updatePackageState(pack, { isArchived: !pack.isArchived, isActive: false }, pack.isArchived ? 'Restauration' : 'Archivage')}>{pack.isArchived ? 'Restaurer' : 'Archiver'}</button>
                      <button className="btn btn-secondary admin-sm-btn text-danger" onClick={() => removePackageItem(pack)} disabled={packageReferenceCount(pack) > 0}><Trash2 size={12} /> Supprimer</button>
                    </div>
                  </div>
                ))}
              </div>
            </Motion.div>
          )}

          {activeTab === 'availability' && (
            <Motion.div 
              key="availability"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Disponibilités & <span>Blocages</span></h1>
              </div>

              <div className="admin-card" style={{ marginBottom: '2.5rem' }}>
                <h2>Créer un Blocage Temporaire</h2>
                <form onSubmit={createBlock} className="admin-form-grid">
                  <div>
                    <label htmlFor="availability-start" className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Début (heure de Douala) *</label>
                    <input id="availability-start" autoComplete="off" name="startAt" type="datetime-local" required className="form-input" />
                  </div>
                  <div>
                    <label htmlFor="availability-end" className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Fin (heure de Douala) *</label>
                    <input id="availability-end" autoComplete="off" name="endAt" type="datetime-local" required className="form-input" />
                  </div>
                  <div>
                    <label htmlFor="availability-reason" className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>Raison / Motif</label>
                    <input id="availability-reason" autoComplete="off" name="reason" type="text" placeholder="Ex: Maintenance, Congés" className="form-input" />
                  </div>
                  <button className="btn btn-primary" style={{ padding: '0.9rem', width: '100%' }}>
                    Bloquer ces créneaux
                  </button>
                </form>
              </div>

              <div className="admin-card">
                <h2>Créneaux Bloqués Actuels</h2>
                {blocks.length === 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '2rem 0', margin: 0 }}>
                    Aucun blocage de calendrier configuré.
                  </p>
                )}
                {blocks.map((block) => (
                  <div 
                    key={block.id} 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem 0' }}
                  >
                    <div>
                      <strong style={{ color: '#fff' }}>{dateTime(block.startAt)} — {dateTime(block.endAt)}</strong>
                      <small style={{ color: 'rgba(255,255,255,0.4)', display: 'block', marginTop: '0.25rem' }}>
                        Motif : {block.reason || 'Non spécifié'}
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary admin-sm-btn"
                        onClick={() => editBlock(block)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-secondary admin-sm-btn text-danger"
                        onClick={() => runAction('Suppression blocage', () => deleteAdminAvailabilityBlock(block.id))}
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Motion.div>
          )}

          {activeTab === 'portfolio' && (
            <Motion.div 
              key="portfolio"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Gestion du <span>Portfolio</span></h1>
              </div>

              <div className="admin-card" style={{ marginBottom: '2.5rem' }}>
                <h2>Ajouter un Média</h2>
                <form onSubmit={createMedia} className="admin-form-grid portfolio-form-grid" style={{ gap: '1.5rem 1.5rem' }}>
                  <div>
                    <label htmlFor="portfolio-title" style={{ display: 'block', marginBottom: '0.5rem' }}>Titre *</label>
                    <input id="portfolio-title" autoComplete="off" name="title" placeholder="Ex: Portrait Studio Luxe" required className="form-input" />
                  </div>
                  <div>
                    <label htmlFor="portfolio-file" style={{ display: 'block', marginBottom: '0.5rem' }}>Fichier Image *</label>
                    <input id="portfolio-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="form-input" style={{ paddingTop: '0.6rem' }} />
                  </div>
                  <div>
                    <label htmlFor="portfolio-alt" style={{ display: 'block', marginBottom: '0.5rem' }}>Texte alternatif *</label>
                    <input id="portfolio-alt" autoComplete="off" name="altText" placeholder="Décrire précisément le sujet de la photo" className="form-input" required />
                  </div>
                  <div>
                    <label htmlFor="portfolio-category" style={{ display: 'block', marginBottom: '0.5rem' }}>Catégorie *</label>
                    <select id="portfolio-category" name="category" className="form-input" required defaultValue="">
                      <option value="" disabled>Choisir une catégorie éditoriale</option>
                      {PORTFOLIO_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="portfolio-position" style={{ display: 'block', marginBottom: '0.5rem' }}>Position de l'image (CSS)</label>
                    <input id="portfolio-position" autoComplete="off" name="objectPosition" placeholder="Ex: center top, center center" className="form-input" defaultValue="center top" />
                  </div>
                  <div>
                    <label htmlFor="portfolio-sort-order" style={{ display: 'block', marginBottom: '0.5rem' }}>Ordre d’affichage</label>
                    <input id="portfolio-sort-order" name="sortOrder" type="number" min="0" step="1" defaultValue="0" className="form-input" />
                  </div>
                  <div style={{ display: 'flex', gap: '2rem', paddingBottom: '0.5rem' }}>
                    <label htmlFor="portfolio-featured" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input id="portfolio-featured" name="isFeatured" type="checkbox" />
                      <span>Mis en avant</span>
                    </label>
                    <label htmlFor="portfolio-published" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input id="portfolio-published" name="isPublished" type="checkbox" defaultChecked />
                      <span>Publier directement</span>
                    </label>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', padding: '1rem' }}>
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
                        {item.width && item.height ? `${item.width} × ${item.height} px` : 'Dimensions inconnues'}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                        Dérivé principal : {formatBytes(item.fileSize)} · aperçu : {formatBytes(item.thumbnailFileSize)}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                          className="btn btn-secondary admin-sm-btn" 
                          onClick={() => toggleMediaFlag(item, 'isPublished')}
                          style={{ flex: 1 }}
                        >
                          {item.isPublished ? 'Masquer' : 'Publier'}
                        </button>
                        <button 
                          className="btn btn-secondary admin-sm-btn" 
                          onClick={() => toggleMediaFlag(item, 'isFeatured')}
                          style={{ flex: 1 }}
                        >
                          {item.isFeatured ? 'Standard' : 'Vedette'}
                        </button>
                        <button 
                          className="btn btn-secondary admin-sm-btn text-danger" 
                          onClick={() => runAction('Suppression média', () => deleteAdminMedia(item.id))}
                          style={{ width: '100%', marginTop: '0.5rem' }}
                        >
                          <Trash2 size={12} /> Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Motion.div>
          )}

          {activeTab === 'notifications' && (
            <Motion.div 
              key="notifications"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="admin-page-header">
                <h1>Notifications <span>Transactionnelles</span></h1>
              </div>

              <div className="admin-card" style={{ padding: '2rem' }}>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Créée le</th>
                        <th>Canal</th>
                        <th>Type</th>
                        <th>Destinataire</th>
                        <th>Statut</th>
                        <th>Tentatives</th>
                        <th>Rapport d'erreur</th>
                        <th>Disposition</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notifications.map((item) => (
                        <tr key={item.id}>
                          <td>{dateTime(item.createdAt)}</td>
                          <td>{item.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</td>
                          <td>
                            <strong>{statusLabel(item.type)}</strong>
                            <small>{item.reservation?.reference || item.lead?.name || 'Général'}</small>
                          </td>
                          <td>{item.recipient}</td>
                          <td>{pill(item.status)}</td>
                          <td>
                            {item.attemptCount}/{item.maxAttempts}
                            {item.nextAttemptAt && <small>Prochain essai : {dateTime(item.nextAttemptAt)}</small>}
                          </td>
                          <td style={{ color: item.error ? '#ff6b6b' : 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                            {item.error || 'Aucune erreur détectée'}
                          </td>
                          <td>
                            <strong>{notificationResolutionLabel(item.resolution)}</strong>
                            {item.resolutionNote && <small>{item.resolutionNote}</small>}
                            {item.resolvedAt && <small>Classée le {dateTime(item.resolvedAt)}</small>}
                          </td>
                          <td>
                            {item.status !== 'FAILED' ? '—' : !item.resolution ? (
                              <div style={{ display: 'grid', gap: '0.4rem' }}>
                                <button
                                  className="btn btn-secondary admin-sm-btn"
                                  disabled={Boolean(busyActions['notifications:Classification notification'])}
                                  onClick={() => classifyNotification(item, 'OBSOLETE')}
                                >
                                  Classer obsolète
                                </button>
                                <button
                                  className="btn btn-secondary admin-sm-btn"
                                  disabled={Boolean(busyActions['notifications:Classification notification'])}
                                  onClick={() => classifyNotification(item, 'ACTIONABLE_REVIEW_REQUIRED')}
                                >
                                  À examiner
                                </button>
                              </div>
                            ) : item.resolution === 'ACTIONABLE_REVIEW_REQUIRED' ? (
                              <button
                                className="btn btn-secondary admin-sm-btn"
                                disabled={Boolean(busyActions[`notifications:Réessai notification ${item.id}`])}
                                onClick={() => retryNotification(item)}
                              >
                                <RefreshCw size={12} /> Réessayer après examen
                              </button>
                            ) : 'Classée — aucun renvoi'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {notifications.length === 0 && (
                    <p style={{ padding: '2rem 0', color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
                      Aucune notification journalisée dans le système.
                    </p>
                  )}
                </div>
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Details modal with AnimatePresence */}
      <AnimatePresence>
        {selectedRes && (
          <div className="admin-modal-backdrop" onClick={() => setSelectedRes(null)}>
            <Motion.div 
              className="admin-modal-content"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <button onClick={() => setSelectedRes(null)} className="admin-modal-close" type="button" aria-label="Fermer la fenêtre">&times;</button>
              <h2>Réservation <span>{selectedRes.reference}</span></h2>
              
              <div className="admin-modal-info-row">
                <span>Client :</span>
                <strong>{selectedRes.customer?.firstName} {selectedRes.customer?.lastName} ({selectedRes.customer?.phone})</strong>
              </div>
              <div className="admin-modal-info-row">
                <span>Formule :</span>
                <strong>{selectedRes.package?.name} ({currency(selectedRes.package?.price)})</strong>
              </div>
              <div className="admin-modal-info-row">
                <span>Séance programmée :</span>
                <strong>{dateTime(selectedRes.startAt)} — {dateTime(selectedRes.endAt)}</strong>
              </div>
              <div className="admin-modal-info-row">
                <span>Statut réservation :</span>
                <strong>{pill(selectedRes.status)}</strong>
              </div>
              <div className="admin-modal-info-row">
                <span>Statut Paiement :</span>
                <strong>{selectedRes.payments?.[0] ? pill(selectedRes.payments[0].status) : pill('AUCUN PAIEMENT')}</strong>
              </div>
              
              {selectedRes.payments?.[0] && (
                <div className="admin-modal-block">
                  <strong>Détails du Paiement Mobile</strong>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.92rem' }}>Méthode : {selectedRes.payments[0].method || 'Non renseignée'}</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.92rem' }}>Réf. transaction : {selectedRes.payments[0].transactionRef || 'Non fournie'}</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.92rem' }}>N° de Paiement : {selectedRes.payments[0].paymentPhone || 'Non spécifié'}</p>
                </div>
              )}

              {latestCalendarSync(selectedRes) && (
                <div className="admin-modal-block" style={{ borderLeftColor: '#4a9ca8' }}>
                  <strong>Statut calendrier ({latestCalendarSync(selectedRes).provider || 'fournisseur inconnu'})</strong>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.92rem' }}>
                    Statut de sync : {pill(latestCalendarSync(selectedRes).status)}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>
                    Action : {latestCalendarSync(selectedRes).action || '—'} · Tentatives : {latestCalendarSync(selectedRes).attemptCount || 0}
                    {latestCalendarSync(selectedRes).lastAttemptAt ? ` · ${dateTime(latestCalendarSync(selectedRes).lastAttemptAt)}` : ''}
                  </p>
                  {latestCalendarSync(selectedRes).externalEventId && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>
                      ID d'événement externe : {latestCalendarSync(selectedRes).externalEventId}
                    </p>
                  )}
                  {latestCalendarSync(selectedRes).error && (
                    <p style={{ margin: '0.5rem 0 0', color: '#ff6b6b', fontSize: '0.9rem' }}>
                      Erreur de sync : {calendarErrorLabel(latestCalendarSync(selectedRes).error)}
                    </p>
                  )}
                </div>
              )}

              {selectedRes.calendarSyncLogs?.length > 0 && (
                <div className="admin-modal-block" style={{ borderLeftColor: '#4a9ca8' }}>
                  <strong>Historique du calendrier</strong>
                  {selectedRes.calendarSyncLogs.map((log) => (
                    <p key={log.id} style={{ margin: '0.75rem 0 0' }}>
                      <span>{pill(log.status)} · {log.action || '—'}</span><br />
                      <small>{dateTime(log.createdAt)} · tentative {log.attemptCount || 0}</small>
                      {log.error && <><br /><small style={{ color: '#ff8b8b' }}>{calendarErrorLabel(log.error)}</small></>}
                    </p>
                  ))}
                </div>
              )}
              <div className="admin-modal-info-row">
                <span>Consentement image :</span>
                <strong>{selectedRes.consentImage ? 'Accordé (Public)' : 'Refusé (Privé)'}</strong>
              </div>
              
              {selectedRes.extraInfo && (
                <div className="admin-modal-block" style={{ borderLeftColor: '#c5923a' }}>
                  <strong>Notes additionnelles du client</strong>
                  <p style={{ margin: 0, fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>{selectedRes.extraInfo}</p>
                </div>
              )}

              {selectedRes.transitions?.length > 0 && (
                <div className="admin-modal-block">
                  <strong>Historique de la réservation</strong>
                  {selectedRes.transitions.map((transition) => (
                    <p key={transition.id} style={{ margin: '0.75rem 0 0' }}>
                      <span>{pill(transition.fromStatus)} → {pill(transition.toStatus)}</span><br />
                      <small>{transitionActorLabel(transition)} · {dateTime(transition.createdAt)}</small>
                      {transition.oldStartAt && transition.newStartAt && transition.oldStartAt !== transition.newStartAt && (
                        <><br /><small>Créneau : {dateTime(transition.oldStartAt)} → {dateTime(transition.newStartAt)}</small></>
                      )}
                      {transition.reason && <><br /><small>Motif : {transition.reason}</small></>}
                    </p>
                  ))}
                </div>
              )}
              {selectedRes.payments?.[0]?.transitions?.length > 0 && (
                <div className="admin-modal-block" style={{ borderLeftColor: '#4a9ca8' }}>
                  <strong>Historique du paiement</strong>
                  {selectedRes.payments[0].transitions.map((transition) => (
                    <p key={transition.id} style={{ margin: '0.75rem 0 0' }}>
                      <span>{pill(transition.fromStatus)} → {pill(transition.toStatus)}</span><br />
                      <small>{transitionActorLabel(transition)} · {dateTime(transition.createdAt)}</small>
                      {transition.reason && <><br /><small>Motif : {transition.reason}</small></>}
                    </p>
                  ))}
                </div>
              )}
              <div className="admin-action-row" style={{ marginTop: '2.5rem', justifyContent: 'flex-end' }}>
                {reservationActions(selectedRes.status).map((action) => (
                  <button
                    key={action.status}
                    className={`btn btn-secondary admin-sm-btn ${action.destructive ? 'text-danger' : ''}`}
                    onClick={() => updateReservationStatus(selectedRes, action.status, action)}
                    disabled={Boolean(busyActions['reservations:Mise à jour de la réservation'])}
                  >
                    {action.label}
                  </button>
                ))}
                {selectedRes.payments?.[0]?.status === 'PENDING' && <>
                  <button className="btn btn-primary admin-sm-btn" onClick={() => updateFirstPayment(selectedRes, 'VERIFIED')}>Vérifier le paiement</button>
                  <button className="btn btn-secondary admin-sm-btn text-danger" onClick={() => updateFirstPayment(selectedRes, 'REJECTED')}>Rejeter le paiement</button>
                </>}
                {['PENDING_CONFIRMATION', 'CONFIRMED'].includes(selectedRes.status) && (
                  <button
                    className="btn btn-secondary admin-sm-btn"
                    onClick={() => rescheduleReservationItem(selectedRes)}
                    disabled={Boolean(busyActions['reservations:Déplacement de la réservation'])}
                  >
                    Déplacer le créneau
                  </button>
                )}
                {['CONFIRMED', 'CANCELLED'].includes(selectedRes.status) && (
                  <button
                    className="btn btn-secondary admin-sm-btn"
                    onClick={() => syncReservationCalendar(selectedRes)}
                    disabled={
                      latestCalendarSync(selectedRes)?.status === 'PROCESSING' ||
                      Boolean(busyActions['reservations:Synchronisation calendrier'])
                    }
                  >
                    {['FAILED', 'SKIPPED'].includes(latestCalendarSync(selectedRes)?.status)
                      ? 'Réessayer la synchronisation'
                      : 'Synchroniser le calendrier'}
                  </button>
                )}
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {previewPack && (
          <div className="admin-modal-backdrop" onClick={() => setPreviewPack(null)}>
            <Motion.div className="admin-modal-content" onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <button onClick={() => setPreviewPack(null)} className="admin-modal-close" type="button" aria-label="Fermer la fenêtre">&times;</button>
              <h2>Aperçu — <span>{previewPack.name}</span></h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>{previewPack.category}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{previewPack.description || 'Aucune description.'}</p>
              <div className="admin-modal-info-row"><span>Prix :</span><strong>{currency(previewPack.price)}</strong></div>
              <div className="admin-modal-info-row"><span>Durée :</span><strong>{previewPack.durationMin} minutes</strong></div>
              <div className="admin-modal-info-row"><span>Livraison :</span><strong>{previewPack.deliveryLabel || 'Non renseignée'}</strong></div>
              <div className="admin-modal-info-row"><span>Publication :</span><strong>{pill(previewPack.isArchived ? 'ARCHIVED' : previewPack.isActive ? 'ACTIVE' : 'INACTIVE')}</strong></div>
              <div className="admin-modal-info-row"><span>Version :</span><strong>{previewPack.version}</strong></div>
              {previewPack.legalText && <div className="admin-modal-block"><strong>Texte légal</strong><p style={{ whiteSpace: 'pre-wrap' }}>{previewPack.legalText}</p></div>}
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
