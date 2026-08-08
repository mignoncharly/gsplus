import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Menu,
  Trash2, 
  Upload, 
  Users, 
  Activity, 
  Layers, 
  ShieldCheck, 
  FileText,
  AlertCircle,
  Clock,
  RefreshCw,
  X
} from 'lucide-react';
import {
  addAdminReservationPayment,
  cancelAdminReservation,
  createAdminAvailabilityBlock,
  createAdminMedia,
  createAdminWithdrawalRequest,
  createAdminImageConsentEvent,
  deleteAdminAvailabilityBlock,
  deleteAdminMedia,
  decideAdminRescheduleRequest,
  decideAdminWithdrawalRequest,
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
  updateAdminReservation,
  updateAdminAvailabilityBlock,
  verifyAdminPayment,
  verifyAndConfirmAdminReservation,
} from '../lib/api';
import {
  canConfirmReservation,
  canVerifyAndConfirm,
  isReservationEndReached,
  isTemporalOverrideTransition,
  paymentActions,
  reservationActions,
  statusLabel,
  transitionActorLabel,
} from '../lib/admin-workflow';
import { resetFormAfterSuccess } from '../lib/lead-submission';
import { isValidCameroonPhone, PHONE_INVALID_MESSAGE } from '../lib/contact-validation';
import { ADMIN_REFRESH_INTERVAL_MS, shouldRunAdminRefresh } from '../lib/admin-refresh';
import {
  businessDateKey,
  businessDateTimeLocalValue,
  currentBusinessMonthKey,
  doualaLocalDateTimeToIso,
  formatBusinessDateTime,
} from '../lib/business-time';
import { PORTFOLIO_CATEGORIES } from '../lib/portfolio-media';
import { formatFcfa } from '../lib/display-formatters';
import './AdminDashboard.css';

const AdminWhatsAppPanel = React.lazy(() => import('../components/AdminWhatsAppPanel'));
const AdminOpsPanel = React.lazy(() => import('../components/AdminReservationOperationsPanel'));
const AdminActionDialog = React.lazy(() => import('../components/AdminActionDialog'));
const AdminPackagesPanel = React.lazy(() => import('../components/AdminPackagesPanel'));

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'inconnue';
  if (bytes < 1024) return `${bytes} o`;
  return `${(bytes / 1024).toFixed(bytes >= 10240 ? 0 : 1)} Ko`;
};
const maskedProviderId = (value) => {
  const id = String(value || '');
  if (!id) return '';
  return id.length <= 8 ? id : `…${id.slice(-8)}`;
};
const dateTime = formatBusinessDateTime;
const monthKey = currentBusinessMonthKey();

const statusClass = (status) => {
  return `pill-${String(status).toLowerCase()}`;
};

const pill = (status) => (
  <span className={`admin-pill ${statusClass(status)}`}>
    {statusLabel(status)}
  </span>
);

const latestCalendarSync = (reservation) => reservation?.calendarSync || reservation?.calendarSyncLogs?.[0] || null;
const reservationContact = (reservation) => {
  const snapshot = reservation?.snapshot;
  if (!snapshot) {
    return {
      firstName: reservation?.customer?.firstName ?? 'Snapshot',
      lastName: reservation?.customer?.lastName ?? 'indisponible',
      phone: reservation?.customer?.phone ?? '—',
      email: reservation?.customer?.email ?? '',
      whatsappConsent: false,
      whatsappConsentAt: null,
    };
  }
  return {
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    phone: snapshot.notificationPhoneE164,
    email: snapshot.notificationEmail ?? snapshot.email ?? '',
    whatsappConsent: snapshot.whatsappConsent,
    whatsappConsentAt: snapshot.whatsappConsentAt,
  };
};

const reservationIdentityKey = (reservation) => {
  if (!reservation?.snapshot) return reservation?.customerId;
  const contact = reservationContact(reservation);
  return [contact.firstName, contact.lastName, contact.phone, contact.email].join('|');
};

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

const notificationResolutionLabel = (code) => statusLabel(code || 'UNCLASSIFIED');

const pageTransition = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
};

const adminSidebarFocusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState(null);
  const [apiStatus, setApiStatus] = useState({ state: 'checking', message: 'Vérification API...' });
  const [feedback, setFeedback] = useState(null);
  const [loadingTabs, setLoadingTabs] = useState({});
  const [lastSyncedAt, setLastSyncedAt] = useState({});
  const [busyActions, setBusyActions] = useState({});
  const [actionDialog, setActionDialog] = useState(null);
  const feedbackRef = useRef(null);
  const sidebarRef = useRef(null);
  const sidebarCloseRef = useRef(null);
  const sidebarToggleRef = useRef(null);
  const busyActionKeysRef = useRef(new Set());
  const tabRefreshInFlightRef = useRef(new Map());
  const reservationSearchReferenceRef = useRef('');

  const [reservations, setReservations] = useState([]);
  const [reservationReferenceQuery, setReservationReferenceQuery] = useState('');
  const [reservationSearchResults, setReservationSearchResults] = useState(null);
  const [reservationSearchSubmitting, setReservationSearchSubmitting] = useState(false);
  const [leads, setLeads] = useState([]);
  const [packs, setPacks] = useState([]);
  const [media, setMedia] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const refreshAdminTab = useCallback((tab, { reportError = true } = {}) => {
    const existingRequest = tabRefreshInFlightRef.current.get(tab);
    if (existingRequest) return existingRequest;

    setLoadingTabs((current) => ({ ...current, [tab]: true }));
    const request = (async () => {
      try {
        if (tab === 'overview') {
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
        } else if (tab === 'reservations') {
          const reference = reservationSearchReferenceRef.current;
          const [reservationItems, searchItems] = await Promise.all([
            getAdminReservations(),
            reference ? getAdminReservations({ reference }) : Promise.resolve(null),
          ]);
          setReservations(reservationItems);
          setReservationSearchResults(searchItems);
        } else if (tab === 'leads') {
          setLeads(await getAdminLeads());
        } else if (tab === 'tarifs') {
          setPacks(await getAdminPackages());
        } else if (tab === 'availability') {
          setBlocks(await getAdminAvailabilityBlocks());
        } else if (tab === 'portfolio') {
          setMedia(await getAdminMedia());
        } else if (tab === 'notifications') {
          setNotifications(await getAdminNotifications());
        }

        setLastSyncedAt((current) => ({ ...current, [tab]: Date.now() }));
        return true;
      } catch (err) {
        if (reportError) {
          setFeedback({ tab, type: 'error', message: err.message || 'Impossible d’actualiser cette section.' });
        }
        return false;
      } finally {
        tabRefreshInFlightRef.current.delete(tab);
        setLoadingTabs((current) => ({ ...current, [tab]: false }));
      }
    })();

    tabRefreshInFlightRef.current.set(tab, request);
    return request;
  }, []);

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
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const refreshIfVisible = (reportError = false) => {
      if (!shouldRunAdminRefresh({ isAuthenticated, visibilityState: document.visibilityState })) return;
      void refreshAdminTab(activeTab, { reportError });
    };
    const handleVisibilityChange = () => refreshIfVisible(false);

    refreshIfVisible(true);
    const interval = window.setInterval(() => refreshIfVisible(false), ADMIN_REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, isAuthenticated, refreshAdminTab]);
  useEffect(() => {
    if (feedback && feedback.tab === activeTab) {
      feedbackRef.current?.focus();
    }
  }, [feedback, activeTab]);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const background = [
      document.querySelector('.admin-mobile-header'),
      document.querySelector('.admin-main'),
    ].filter(Boolean);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsSidebarOpen(false);
        window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
        return;
      }

      if (event.key !== 'Tab' || !sidebarRef.current) return;
      const focusable = Array.from(sidebarRef.current.querySelectorAll(adminSidebarFocusableSelector));
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

    document.body.style.overflow = 'hidden';
    background.forEach((element) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.addEventListener('keydown', handleKeyDown);
    sidebarCloseRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach((element) => {
        element.inert = false;
        element.removeAttribute('aria-hidden');
      });
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    const desktopViewport = window.matchMedia('(min-width: 992px)');
    const closeSidebarOnDesktop = (event) => {
      if (event.matches) setIsSidebarOpen(false);
    };

    desktopViewport.addEventListener('change', closeSidebarOnDesktop);
    return () => desktopViewport.removeEventListener('change', closeSidebarOnDesktop);
  }, []);

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
      await refreshAdminTab('overview');
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
    setReservationReferenceQuery('');
    reservationSearchReferenceRef.current = '';
    setReservationSearchResults(null);
    setLeads([]);
    setPacks([]);
    setMedia([]);
    setBlocks([]);
    setNotifications([]);
    setLastSyncedAt({});
    tabRefreshInFlightRef.current.clear();
    reservationSearchReferenceRef.current = '';
    setFeedback(null);
  };

  const runAction = async (label, action, propagateError = false) => {
    const key = `${activeTab}:${label}`;
    if (busyActionKeysRef.current.has(key)) return false;
    busyActionKeysRef.current.add(key);
    setBusyActions((current) => ({ ...current, [key]: true }));
    setFeedback({ tab: activeTab, type: 'progress', message: `${label}...` });
    try {
      await action();
      const reloaded = await refreshAdminTab(activeTab, { reportError: false });
      if (!reloaded) throw new Error('Action enregistrée, mais les données n’ont pas pu être rechargées.');
      setFeedback({
        tab: activeTab,
        type: 'success',
        message: `${label} terminé avec succès.`,
      });
      return true;
    } catch (err) {
      setFeedback({ tab: activeTab, type: 'error', message: err.message || `Échec de l'action : ${label}` });
      if (propagateError) throw err;
      return false;
    } finally {
      busyActionKeysRef.current.delete(key);
      setBusyActions((current) => ({ ...current, [key]: false }));
    }
  };

  const refreshActiveTab = async () => {
    const refreshed = await refreshAdminTab(activeTab);
    if (refreshed) {
      setFeedback({ tab: activeTab, type: 'success', message: 'Données actualisées avec succès.' });
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

  const openActionDialog = (config) => setActionDialog({ fields: [], ...config });

  const runDialogAction = async (label, action, refreshReservationId) => {
    const success = await runAction(label, action, true);
    if (!success) throw new Error('Cette action est déjà en cours.');
    if (refreshReservationId) setSelectedRes(await getAdminReservation(refreshReservationId));
  };

  const updateReservationStatus = (reservation, status, action = {}) => {
    const needsReason = action.temporalOverride || action.requiresReason || ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(status);
    const fields = status === 'CANCELLED' ? [{
      name: 'origin', label: 'Origine de l’annulation', type: 'select', required: true, defaultValue: 'CUSTOMER',
      options: [{ value: 'CUSTOMER', label: 'Client' }, { value: 'STUDIO', label: 'Studio' }],
    }] : [];
    if (needsReason) fields.push({ name: 'reason', label: 'Motif', type: 'textarea', required: true });
    const label = action.label || statusLabel(status);
    openActionDialog({
      title: action.temporalOverride ? 'Confirmer une dérogation temporelle' : 'Mettre à jour la réservation',
      summary: reservation.reference + ' · ' + statusLabel(reservation.status) + ' → ' + label,
      consequence: action.temporalOverride ? 'La clôture anticipée et son motif seront audités.' : 'Le statut, le motif et l’auteur seront inscrits dans l’historique.',
      confirmLabel: label,
      destructive: Boolean(action.destructive || action.temporalOverride),
      fields,
      onConfirm: (values) => runDialogAction('Mise à jour de la réservation', async () => {
        if (status === 'CANCELLED') {
          await cancelAdminReservation(reservation.id, {
            commandId: window.crypto.randomUUID(), expectedVersion: reservation.version,
            origin: values.origin, reason: values.reason.trim(),
          });
          return;
        }
        const versioned = ['CONFIRMED', 'REJECTED', 'COMPLETED', 'NO_SHOW'].includes(status);
        await updateAdminReservation(reservation.id, {
          status, reason: values.reason?.trim() || undefined,
          ...(versioned ? { commandId: window.crypto.randomUUID(), expectedVersion: reservation.version } : {}),
          ...(action.temporalOverride ? { temporalOverride: true, overrideConfirmed: true } : {}),
        });
      }, reservation.id),
    });
  };

  const updateFirstPayment = (reservation, action) => {
    const payment = reservation.payments?.[0];
    if (!payment) {
      setFeedback({ tab: 'reservations', type: 'error', message: 'Aucun paiement associé à cette réservation.' });
      return;
    }
    const fields = [];
    if (action.requiresTransactionReference) fields.push({ name: 'transactionRef', label: 'Référence de transaction', required: true, defaultValue: payment.transactionRef || '' });
    if (action.requiresReason) fields.push({ name: 'reason', label: 'Motif', type: 'textarea', required: true });
    openActionDialog({
      title: 'Décision de paiement', summary: reservation.reference + ' · ' + action.label,
      consequence: 'La décision sera versionnée et auditée.', confirmLabel: action.label,
      destructive: Boolean(action.destructive), fields,
      onConfirm: (values) => runDialogAction('Décision de paiement', () => verifyAdminPayment(payment.id, {
        status: action.status, reason: values.reason?.trim() || undefined,
        transactionRef: values.transactionRef?.trim() || undefined,
        commandId: window.crypto.randomUUID(), expectedVersion: payment.version,
      }), reservation.id),
    });
  };

  const addReservationPayment = (reservation) => openActionDialog({
    title: 'Ajouter un paiement', summary: reservation.reference,
    consequence: 'Les informations seront liées à la réservation pour vérification.',
    confirmLabel: 'Ajouter le paiement',
    fields: [
      { name: 'method', label: 'Opérateur', type: 'select', required: true, defaultValue: 'mtn_momo', options: [{ value: 'mtn_momo', label: 'MTN MoMo' }, { value: 'orange_money', label: 'Orange Money' }] },
      { name: 'paymentPhone', label: 'Téléphone de paiement', type: 'tel', inputMode: 'tel', required: true, validate: (value) => isValidCameroonPhone(String(value)) ? '' : PHONE_INVALID_MESSAGE },
      { name: 'transactionRef', label: 'Référence de transaction', required: true },
    ],
    onConfirm: (values) => runDialogAction('Ajout du paiement', () => addAdminReservationPayment(reservation.id, {
      commandId: window.crypto.randomUUID(), expectedReservationVersion: reservation.version,
      method: values.method, paymentPhone: values.paymentPhone.trim(), transactionRef: values.transactionRef.trim(),
    }), reservation.id),
  });

  const verifyAndConfirmReservation = (reservation) => {
    const payment = reservation.payments?.[0];
    if (!payment) return;
    openActionDialog({
      title: 'Vérifier le paiement et confirmer', summary: reservation.reference + ' · paiement ' + statusLabel(payment.status),
      consequence: 'Le paiement sera vérifié et la réservation confirmée dans une commande atomique auditée.',
      confirmLabel: 'Vérifier et confirmer',
      fields: [{ name: 'transactionRef', label: 'Référence de transaction', required: true, defaultValue: payment.transactionRef || '' }],
      onConfirm: (values) => runDialogAction('Vérification et confirmation', () => verifyAndConfirmAdminReservation(reservation.id, {
        commandId: window.crypto.randomUUID(), paymentId: payment.id,
        expectedPaymentVersion: payment.version, expectedReservationVersion: reservation.version,
        transactionRef: values.transactionRef.trim(),
      }), reservation.id),
    });
  };

  const simpleAction = (config, label, action) => openActionDialog({
    fields: [], confirmLabel: label, ...config,
    onConfirm: () => runDialogAction(label, action),
  });

  const updateLeadStatus = (lead, status) => simpleAction({
    title: 'Mettre à jour la demande', summary: (lead.company || lead.name) + ' · ' + statusLabel(lead.status) + ' → ' + statusLabel(status),
    consequence: 'Le nouveau statut sera enregistré dans le dossier.',
  }, 'Mettre à jour', () => updateAdminLead(lead.id, { status }));

  const classifyNotification = (item, resolution) => {
    const note = resolution === 'OBSOLETE' ? 'Événement historique devenu sans objet; aucun renvoi autorisé.' : 'Événement potentiellement pertinent; examen individuel requis avant tout renvoi.';
    openActionDialog({
      title: 'Classer la notification', summary: item.type + ' · ' + (item.reservation?.reference || item.lead?.name || item.id),
      consequence: 'La classification sera enregistrée sans envoyer de message.',
      confirmLabel: 'Enregistrer la classification',
      fields: [{ name: 'note', label: 'Note de classification', type: 'textarea', required: true, defaultValue: note }],
      onConfirm: (values) => runDialogAction('Classification notification', () => resolveAdminNotification(item.id, { resolution, note: values.note.trim() })),
    });
  };

  const retryNotification = (item) => simpleAction({
    title: 'Réessayer la notification', summary: item.type + ' · ' + (item.reservation?.reference || item.lead?.name || item.id),
    consequence: 'Seule cette notification sera remise en file.',
  }, 'Réessayer', () => retryAdminNotification(item.id));

  const syncReservationCalendar = async (reservation) => {
    const success = await runAction('Synchronisation calendrier', () => syncAdminReservationCalendar(reservation.id));
    if (success) setSelectedRes(await getAdminReservation(reservation.id));
  };

  const rescheduleReservationItem = (reservation) => openActionDialog({
    title: 'Demander un report', summary: reservation.reference + ' · ' + dateTime(reservation.startAt),
    consequence: 'Le créneau actuel reste réservé jusqu’à une décision propriétaire séparée.',
    confirmLabel: 'Créer la demande',
    fields: [
      { name: 'requestedStartAt', label: 'Nouveau créneau à Douala', type: 'datetime-local', required: true, defaultValue: businessDateTimeLocalValue(reservation.startAt) },
      { name: 'reason', label: 'Motif de la demande', type: 'textarea', required: true },
    ],
    onConfirm: async (values) => {
      let startAt;
      try { startAt = doualaLocalDateTimeToIso(values.requestedStartAt); }
      catch { throw new Error('Le nouveau créneau est invalide.'); }
      await runDialogAction('Demande de report', () => rescheduleAdminReservation(reservation.id, {
        commandId: window.crypto.randomUUID(), expectedReservationVersion: reservation.version,
        requestedStartAt: startAt, reason: values.reason.trim(),
      }), reservation.id);
    },
  });

  const decideRescheduleRequest = (reservation, request, decision) => {
    const accepted = decision === 'ACCEPTED';
    openActionDialog({
      title: accepted ? 'Accepter la demande de report' : 'Refuser la demande de report',
      summary: reservation.reference + ' · ' + dateTime(request.oldStartAt) + ' → ' + dateTime(request.requestedStartAt),
      consequence: accepted ? 'Le créneau sera déplacé après revalidation.' : 'Le créneau initial restera inchangé.',
      confirmLabel: accepted ? 'Accepter le report' : 'Refuser le report', destructive: !accepted,
      fields: [{ name: 'reason', label: 'Motif de la décision', type: 'textarea', required: true }],
      onConfirm: (values) => runDialogAction('Décision de report', () => decideAdminRescheduleRequest(request.id, {
        commandId: window.crypto.randomUUID(), expectedVersion: request.version,
        decision, reason: values.reason.trim(),
      }), reservation.id),
    });
  };

  const recordWithdrawalRequest = (reservation) => openActionDialog({
    title: 'Enregistrer une demande de rétractation',
    summary: reservation.reference,
    consequence: 'La demande et son contexte seront figés pour une décision propriétaire séparée. Aucun remboursement ne sera marqué automatiquement.',
    confirmLabel: 'Enregistrer la demande',
    fields: [
      { name: 'receivedAt', label: 'Date de réception à Douala', type: 'datetime-local', required: true, defaultValue: businessDateTimeLocalValue(new Date()) },
      { name: 'requestChannel', label: 'Canal de réception', type: 'select', required: true, defaultValue: 'EMAIL', options: [
        { value: 'EMAIL', label: 'E-mail info@gsplus.vip' },
        { value: 'WHATSAPP', label: 'WhatsApp professionnel' },
        { value: 'PHONE', label: 'Téléphone' },
        { value: 'IN_PERSON', label: 'En personne' },
        { value: 'OTHER', label: 'Autre canal professionnel' },
      ] },
      { name: 'requestText', label: 'Demande explicite reçue', type: 'textarea', required: true },
      { name: 'requestEvidence', label: 'Preuve conservée', type: 'textarea', required: true, help: 'Ex. Message-ID du courriel, emplacement de l’archive ou compte rendu signé.' },
      { name: 'serviceStatus', label: 'État du service à la réception', type: 'select', required: true, defaultValue: 'NOT_STARTED', options: [
        { value: 'NOT_STARTED', label: 'Service non commencé' },
        { value: 'STARTED', label: 'Service commencé' },
        { value: 'COMPLETED', label: 'Service achevé' },
      ] },
      { name: 'executionStartedAt', label: 'Début d’exécution à Douala', type: 'datetime-local', help: 'Obligatoire uniquement si le service a commencé ou est achevé.' },
    ],
    validate: (values) => {
      if (values.serviceStatus === 'NOT_STARTED' && values.executionStartedAt) {
        return { executionStartedAt: 'Laissez cette date vide pour un service non commencé.' };
      }
      if (values.serviceStatus !== 'NOT_STARTED' && !values.executionStartedAt) {
        return { executionStartedAt: 'Renseignez le début d’exécution.' };
      }
      return {};
    },
    onConfirm: async (values) => {
      let receivedAt;
      let executionStartedAt = null;
      try {
        receivedAt = doualaLocalDateTimeToIso(values.receivedAt);
        if (values.executionStartedAt) executionStartedAt = doualaLocalDateTimeToIso(values.executionStartedAt);
      } catch {
        throw new Error('Les dates de la demande de rétractation sont invalides.');
      }
      await runDialogAction('Demande de rétractation', () => createAdminWithdrawalRequest(reservation.id, {
        commandId: window.crypto.randomUUID(),
        expectedReservationVersion: reservation.version,
        receivedAt,
        requestChannel: values.requestChannel,
        requestText: values.requestText.trim(),
        requestEvidence: values.requestEvidence.trim(),
        serviceStatus: values.serviceStatus,
        executionStartedAt,
      }), reservation.id);
    },
  });

  const decideWithdrawalRequest = (reservation, request, decision) => {
    const accepted = decision === 'ACCEPTED';
    openActionDialog({
      title: accepted ? 'Accepter la demande de rétractation' : 'Refuser la demande de rétractation',
      summary: reservation.reference + ' · reçue ' + dateTime(request.receivedAt),
      consequence: 'La décision motivée sera auditée. L’annulation et tout remboursement restent des opérations séparées.',
      confirmLabel: accepted ? 'Accepter la rétractation' : 'Refuser la rétractation',
      destructive: !accepted,
      fields: [{ name: 'reason', label: 'Analyse et motif de la décision', type: 'textarea', required: true }],
      onConfirm: (values) => runDialogAction('Décision de rétractation', () => decideAdminWithdrawalRequest(request.id, {
        commandId: window.crypto.randomUUID(),
        expectedVersion: request.version,
        decision,
        reason: values.reason.trim(),
      }), reservation.id),
    });
  };

  const recordImageConsentChoice = (reservation, choice, current) => {
    const withdrawing = choice === 'WITHDRAWN';
    openActionDialog({
      title: withdrawing ? 'Enregistrer le retrait du droit à l’image' : 'Enregistrer une autorisation d’image',
      summary: reservation.reference,
      consequence: withdrawing
        ? 'Le retrait cessera les nouvelles utilisations pour l’avenir sans effacer les preuves ni les autres données du dossier.'
        : 'Une nouvelle autorisation explicite sera versionnée avec sa finalité, sa portée et sa preuve.',
      confirmLabel: withdrawing ? 'Enregistrer le retrait image' : 'Enregistrer l’autorisation image',
      destructive: withdrawing,
      fields: [
        { name: 'receivedAt', label: 'Date du choix à Douala', type: 'datetime-local', required: true, defaultValue: businessDateTimeLocalValue(new Date()) },
        { name: 'requestChannel', label: 'Canal de preuve', type: 'select', required: true, defaultValue: 'EMAIL', options: [
          { value: 'EMAIL', label: 'E-mail' },
          { value: 'WHATSAPP', label: 'WhatsApp professionnel' },
          { value: 'PHONE', label: 'Téléphone avec compte rendu' },
          { value: 'IN_PERSON', label: 'En personne avec compte rendu' },
          { value: 'SIGNED_DOCUMENT', label: 'Document signé' },
          { value: 'OTHER', label: 'Autre preuve vérifiable' },
        ] },
        { name: 'requestEvidence', label: 'Preuve du choix explicite', type: 'textarea', required: true, help: 'Indiquez le Message-ID, le document signé ou l’emplacement du compte rendu conservé.' },
      ],
      onConfirm: (values) => runDialogAction('Choix relatif au droit à l’image', () => createAdminImageConsentEvent(reservation.id, {
          commandId: window.crypto.randomUUID(),
          expectedPriorEventId: current?.id ?? null,
          choice,
          receivedAt: doualaLocalDateTimeToIso(values.receivedAt),
          requestChannel: values.requestChannel,
          requestEvidence: values.requestEvidence.trim(),
        }), reservation.id),
    });
  };

  const createBlock = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const success = await runAction('Blocage calendrier', () => createAdminAvailabilityBlock({
      startAt: doualaLocalDateTimeToIso(form.get('startAt')),
      endAt: doualaLocalDateTimeToIso(form.get('endAt')),
      reason: form.get('reason') || undefined,
    }));
    resetFormAfterSuccess(formElement, success);
  };

  const editBlock = (item) => openActionDialog({
    title: 'Modifier le blocage calendrier', summary: dateTime(item.startAt) + ' → ' + dateTime(item.endAt),
    consequence: 'La disponibilité publique sera recalculée.', confirmLabel: 'Enregistrer le blocage',
    fields: [
      { name: 'startAt', label: 'Début à Douala', type: 'datetime-local', required: true, defaultValue: businessDateTimeLocalValue(item.startAt) },
      { name: 'endAt', label: 'Fin à Douala', type: 'datetime-local', required: true, defaultValue: businessDateTimeLocalValue(item.endAt) },
      { name: 'reason', label: 'Raison / motif', defaultValue: item.reason || '' },
    ],
    onConfirm: async (values) => {
      let startAt; let endAt;
      try { startAt = doualaLocalDateTimeToIso(values.startAt); endAt = doualaLocalDateTimeToIso(values.endAt); }
      catch { throw new Error('Les dates du blocage sont invalides.'); }
      await runDialogAction('Modification blocage', () => updateAdminAvailabilityBlock(item.id, {
        startAt, endAt, reason: values.reason.trim() || undefined,
      }));
    },
  });

  const removeAvailabilityBlock = (item) => simpleAction({
    title: 'Supprimer le blocage calendrier', summary: dateTime(item.startAt) + ' → ' + dateTime(item.endAt),
    consequence: 'Les créneaux pourront redevenir disponibles immédiatement.', destructive: true,
  }, 'Supprimer le blocage', () => deleteAdminAvailabilityBlock(item.id));

  const removeMediaItem = (item) => simpleAction({
    title: 'Supprimer le média', summary: item.title,
    consequence: 'Le fichier et ses dérivés disparaîtront de la galerie.', destructive: true,
  }, 'Supprimer le média', () => deleteAdminMedia(item.id));

  const createMedia = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const success = await runAction('Upload média', () => createAdminMedia(form));
    resetFormAfterSuccess(formElement, success);
  };

  const toggleMediaFlag = (item, field) =>
    runAction('Mise à jour média', () => updateAdminMedia(item.id, { [field]: !item[field] }));

  const searchReservationsByReference = async (event) => {
    event.preventDefault();
    const reference = reservationReferenceQuery.trim().toUpperCase();

    if (!reference) {
      setReservationSearchResults(null);
      setFeedback({ tab: 'reservations', type: 'success', message: 'Toutes les réservations sont affichées.' });
      return;
    }

    setReservationSearchSubmitting(true);
    setFeedback({ tab: 'reservations', type: 'progress', message: 'Recherche de la référence publique...' });
    try {
      const matches = await getAdminReservations({ reference });
      setReservationReferenceQuery(reference);
      reservationSearchReferenceRef.current = reference;
      setReservationSearchResults(matches);
      setFeedback({
        tab: 'reservations',
        type: 'success',
        message: matches.length
          ? `Réservation ${reference} trouvée.`
          : `Aucune réservation trouvée pour ${reference}.`,
      });
    } catch (err) {
      setFeedback({
        tab: 'reservations',
        type: 'error',
        message: err.message || 'La recherche par référence a échoué.',
      });
    } finally {
      setReservationSearchSubmitting(false);
    }
  };

  const clearReservationReferenceSearch = () => {
    setReservationReferenceQuery('');
    setReservationSearchResults(null);
    setFeedback({ tab: 'reservations', type: 'success', message: 'Toutes les réservations sont affichées.' });
  };

  const displayedReservations = reservationSearchResults ?? reservations;

  const paidRevenueThisMonth = reservations
    .filter((reservation) => reservation.startAt && businessDateKey(new Date(reservation.startAt)).startsWith(monthKey))
    .flatMap((reservation) => reservation.payments || [])
    .filter((payment) => ['VERIFIED', 'PAID'].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);

  const uniqueCustomers = new Set(reservations.map((reservation) => reservationIdentityKey(reservation))).size;
  const selectedContact = reservationContact(selectedRes);
  const selectedPayment = selectedRes?.payments?.[0];
  const selectedEndReached = isReservationEndReached(selectedRes?.endAt);
  const ownerDecisionDisabled = adminUser?.role !== 'OWNER';
  const reservationDecisionBusy = Boolean(
    busyActions['reservations:Mise à jour de la réservation'] ||
    busyActions['reservations:Décision de paiement'] ||
    busyActions['reservations:Vérification et confirmation'],
  );

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
    ['notifications', 'Communications', Mail],
  ];

  const closeSidebar = ({ restoreFocus = false } = {}) => {
    setIsSidebarOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
    }
  };

  return (
    <div className="admin-layout">
      <header className="admin-mobile-header">
        <button
          ref={sidebarToggleRef}
          type="button"
          className="admin-menu-toggle"
          aria-controls="admin-sidebar"
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={22} aria-hidden="true" />
          <span>Menu</span>
        </button>
        <span className="admin-mobile-brand">GS<span>+</span> Admin</span>
      </header>

      {isSidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Fermer le menu administrateur"
          onClick={() => closeSidebar({ restoreFocus: true })}
        />
      )}

      {/* Sidebar navigation */}
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        className={`admin-sidebar ${isSidebarOpen ? 'is-open' : ''}`}
        role={isSidebarOpen ? 'dialog' : undefined}
        aria-modal={isSidebarOpen ? 'true' : undefined}
        aria-label={isSidebarOpen ? 'Navigation administrateur' : undefined}
      >
        <button
          ref={sidebarCloseRef}
          type="button"
          className="admin-sidebar-close"
          aria-label="Fermer le menu"
          onClick={() => closeSidebar({ restoreFocus: true })}
        >
          <X size={22} aria-hidden="true" />
        </button>

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
                closeSidebar({ restoreFocus: true });
              }} 
              className={`admin-nav-btn ${activeTab === key ? 'active' : ''}`}
              aria-current={activeTab === key ? 'page' : undefined}
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
      <section className="admin-status-banner admin-refresh-bar" aria-label="Fraîcheur des données administratives">
        <p role="status" aria-live="polite">
          Dernière actualisation : {lastSyncedAt[activeTab]
            ? `${dateTime(lastSyncedAt[activeTab])} — heure de Douala`
            : 'en attente — heure de Douala'}
        </p>
        <button
          type="button"
          className="btn btn-secondary admin-refresh-button"
          onClick={refreshActiveTab}
          disabled={Boolean(loadingTabs[activeTab])}
        >
          <RefreshCw className={loadingTabs[activeTab] ? 'animate-spin' : undefined} size={17} aria-hidden="true" />
          {loadingTabs[activeTab] ? 'Actualisation…' : 'Actualiser'}
        </button>
      </section>
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
                  <div className="admin-stat-num" style={{ fontSize: '1.4rem', whiteSpace: 'nowrap' }}>{formatFcfa(paidRevenueThisMonth)}</div>
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
                <form className="admin-reference-search" onSubmit={searchReservationsByReference}>
                  <label htmlFor="reservation-reference-search">Rechercher par référence</label>
                  <div className="admin-reference-search-controls">
                    <input
                      id="reservation-reference-search"
                      className="form-input"
                      type="search"
                      value={reservationReferenceQuery}
                      onChange={(event) => setReservationReferenceQuery(event.target.value)}
                      placeholder="GSP-AAMMJJ-XXXX"
                      autoCapitalize="characters"
                      autoComplete="off"
                      maxLength={32}
                    />
                    <button className="btn btn-primary admin-sm-btn" type="submit" disabled={reservationSearchSubmitting}>
                      {reservationSearchSubmitting ? 'Recherche...' : 'Rechercher'}
                    </button>
                    {(reservationReferenceQuery || reservationSearchResults) && (
                      <button className="btn btn-secondary admin-sm-btn" type="button" onClick={clearReservationReferenceSearch}>
                        Effacer
                      </button>
                    )}
                  </div>
                  <small>La recherche accepte aussi les références historiques et ignore la casse.</small>
                </form>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Référence publique</th>
                        <th>Date & Heure</th>
                        <th>Client</th>
                        <th>Pack Sélectionné</th>
                        <th>Statut</th>
                        <th>Paiement</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedReservations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="admin-table-empty">Aucune réservation ne correspond à cette référence.</td>
                        </tr>
                      )}
                      {displayedReservations.map((reservation) => {
                        const payment = reservation.payments?.[0];
                        const contact = reservationContact(reservation);
                        return (
                          <tr key={reservation.id}>
                            <td><code className="admin-public-reference">{reservation.reference}</code></td>
                            <td>{dateTime(reservation.startAt)}</td>
                            <td>
                              <strong>{contact.firstName} {contact.lastName}</strong>
                              <small>{contact.phone}</small>
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
            <Motion.div key="tarifs" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement des tarifs...</div>}>
                <AdminPackagesPanel
                  packs={packs}
                  adminUser={adminUser}
                  onRefresh={() => refreshAdminTab('tarifs')}
                  onFeedback={setFeedback}
                />
              </React.Suspense>
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
                        onClick={() => removeAvailabilityBlock(block)}
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
                          onClick={() => removeMediaItem(item)}
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
                            {item.templateCode && (
                              <small>Modèle {item.templateCode}{item.templateVersion ? ` · v${item.templateVersion}` : ''}</small>
                            )}
                          </td>
                          <td>{item.recipient}</td>
                          <td>
                            {pill(item.status)}
                            {item.providerStatus && <small>Fournisseur : {item.providerStatus}</small>}
                            {item.deliveredAt && <small>Livré : {dateTime(item.deliveredAt)}</small>}
                            {item.readAt && <small>Lu : {dateTime(item.readAt)}</small>}
                          </td>
                          <td>
                            {item.attemptCount}/{item.maxAttempts}
                            {item.nextAttemptAt && <small>Prochain essai : {dateTime(item.nextAttemptAt)}</small>}
                            {item.attempts?.map((attempt) => (
                              <small key={attempt.id}>
                                Essai {attempt.attemptNumber} : {statusLabel(attempt.status)}
                                {attempt.startedAt ? ` · ${dateTime(attempt.startedAt)}` : ''}
                                {attempt.providerStatus ? ` · ${attempt.providerStatus}` : ''}
                                {attempt.providerMessageId ? ` · ID ${maskedProviderId(attempt.providerMessageId)}` : ''}
                              </small>
                            ))}
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

      {actionDialog && (
        <React.Suspense fallback={null}>
          <AdminActionDialog config={actionDialog} onClose={() => setActionDialog(null)} />
        </React.Suspense>
      )}

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
                <strong>{selectedContact.firstName} {selectedContact.lastName} ({selectedContact.phone})</strong>
              </div>
              <React.Suspense fallback={<div className="admin-modal-info-row"><span>Consentement WhatsApp :</span><strong>Chargement…</strong></div>}>
                <AdminWhatsAppPanel reservation={selectedRes} />
              </React.Suspense>
              <div className="admin-modal-info-row">
                <span>Formule :</span>
                <strong>{selectedRes.package?.name} ({formatFcfa(selectedRes.package?.price)})</strong>
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
                    {latestCalendarSync(selectedRes).nextAttemptAt ? ` · prochaine tentative ${dateTime(latestCalendarSync(selectedRes).nextAttemptAt)}` : ''}
                    {latestCalendarSync(selectedRes).syncedAt ? ` · synchronisé ${dateTime(latestCalendarSync(selectedRes).syncedAt)}` : ''}
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
                      {isTemporalOverrideTransition(transition) && (
                        <><br /><small className="admin-temporal-override">Dérogation temporelle — clôture avant la fin programmée</small></>
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
              <React.Suspense>
                <AdminOpsPanel
                  reservation={selectedRes}
                  dateTime={dateTime}
                  pill={pill}
                  busy={reservationDecisionBusy}
                  ownerDisabled={ownerDecisionDisabled}
                  onPublished={() => getAdminReservation(selectedRes.id).then(setSelectedRes)}
                  onDecision={(request, decision, reason) =>
                    decideRescheduleRequest(selectedRes, request, decision, reason)}
                  onWithdrawalDecision={(request, decision) =>
                    decideWithdrawalRequest(selectedRes, request, decision)}
                  onImageConsentRecord={(choice, current) =>
                    recordImageConsentChoice(selectedRes, choice, current)}
                />
              </React.Suspense>
              <div className="admin-action-row" style={{ marginTop: '2.5rem', justifyContent: 'flex-end' }}>
                {reservationActions(selectedRes.status).map((action) => {
                  const confirmationBlocked =
                    action.status === 'CONFIRMED' && !canConfirmReservation(selectedPayment?.status);
                  const temporalClosureBlocked = action.temporalClosure && !selectedEndReached;
                  const permissionBlocked =
                    ['CONFIRMED', 'REJECTED', 'CANCELLED'].includes(action.status) && ownerDecisionDisabled;
                  return (
                    <button
                      key={action.status}
                      className={`btn btn-secondary admin-sm-btn ${action.destructive ? 'text-danger' : ''}`}
                      onClick={() => updateReservationStatus(selectedRes, action.status, action)}
                      disabled={reservationDecisionBusy || confirmationBlocked || permissionBlocked || temporalClosureBlocked}
                      title={
                        temporalClosureBlocked
                          ? `Action disponible après la fin du créneau (${dateTime(selectedRes.endAt)}).`
                          : confirmationBlocked
                            ? 'Vérifiez d’abord le paiement avant de confirmer la réservation.'
                            : permissionBlocked
                              ? 'Cette décision nécessite le rôle propriétaire.'
                              : undefined
                      }
                    >
                      {action.label}
                    </button>
                  );
                })}
                {!selectedEndReached && reservationActions(selectedRes.status)
                  .filter((action) => action.temporalClosure)
                  .map((action) => (
                    <button
                      key={`override-${action.status}`}
                      className="btn btn-secondary admin-sm-btn text-danger"
                      onClick={() => updateReservationStatus(selectedRes, action.status, {
                        ...action,
                        temporalOverride: true,
                        label: `Dérogation : ${action.label.toLowerCase()}`,
                      })}
                      disabled={reservationDecisionBusy || ownerDecisionDisabled}
                      title={ownerDecisionDisabled
                        ? 'La dérogation temporelle nécessite le rôle propriétaire.'
                        : 'Clôture exceptionnelle avant la fin; motif et confirmation obligatoires.'}
                    >
                      Dérogation : {action.label.toLowerCase()}
                    </button>
                  ))}
                {selectedPayment && paymentActions(selectedPayment.status).map((action) => (
                  <button
                    key={`payment-${action.status}`}
                    className={`btn btn-secondary admin-sm-btn ${action.destructive ? 'text-danger' : ''}`}
                    onClick={() => updateFirstPayment(selectedRes, action)}
                    disabled={reservationDecisionBusy || ownerDecisionDisabled}
                    title={ownerDecisionDisabled ? 'Cette décision nécessite le rôle propriétaire.' : undefined}
                  >
                    {action.label}
                  </button>
                ))}
                {!selectedPayment && selectedRes.status === 'PENDING_CONFIRMATION' && (
                  <button
                    className="btn btn-secondary admin-sm-btn"
                    onClick={() => addReservationPayment(selectedRes)}
                    disabled={reservationDecisionBusy || ownerDecisionDisabled}
                    title={ownerDecisionDisabled ? 'Cette action nécessite le rôle propriétaire.' : undefined}
                  >
                    Ajouter un paiement
                  </button>
                )}
                {canVerifyAndConfirm(selectedRes.status, selectedPayment?.status) && (
                  <button
                    className="btn btn-primary admin-sm-btn"
                    onClick={() => verifyAndConfirmReservation(selectedRes)}
                    disabled={reservationDecisionBusy || ownerDecisionDisabled}
                    title={ownerDecisionDisabled ? 'Cette décision nécessite le rôle propriétaire.' : undefined}
                  >
                    Vérifier et confirmer
                  </button>
                )}
                {['PENDING_CONFIRMATION', 'CONFIRMED'].includes(selectedRes.status) && (
                  <button
                    className="btn btn-secondary admin-sm-btn"
                    onClick={() => rescheduleReservationItem(selectedRes)}
                    disabled={Boolean(busyActions['reservations:Déplacement de la réservation'])}
                  >
                    Demander un report
                  </button>
                )}
                <button
                  className="btn btn-secondary admin-sm-btn"
                  onClick={() => recordWithdrawalRequest(selectedRes)}
                  disabled={reservationDecisionBusy || ownerDecisionDisabled || selectedRes.withdrawalRequests?.some((request) => request.status === 'PENDING')}
                  title={ownerDecisionDisabled
                    ? 'Cette action nécessite le rôle propriétaire.'
                    : selectedRes.withdrawalRequests?.some((request) => request.status === 'PENDING')
                      ? 'Une demande de rétractation est déjà en attente.'
                      : 'Enregistrer une demande explicite reçue par un canal professionnel.'}
                >
                  Enregistrer une rétractation
                </button>
                {['CONFIRMED', 'CANCELLED'].includes(selectedRes.status) && (
                  <button
                    className="btn btn-secondary admin-sm-btn"
                    onClick={() => syncReservationCalendar(selectedRes)}
                    disabled={
                      latestCalendarSync(selectedRes)?.status === 'SYNCING' ||
                      Boolean(busyActions['reservations:Synchronisation calendrier'])
                    }
                  >
                    {['FAILED', 'RETRYING'].includes(latestCalendarSync(selectedRes)?.status)
                      ? 'Réessayer la synchronisation'
                      : 'Synchroniser le calendrier'}
                  </button>
                )}
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
