import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  KeyRound,
  Mail, 
  Menu,
  Trash2, 
  Users, 
  Activity, 
  Layers, 
  Settings,
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
  acceptAdminInvitation,
  createAdminAvailabilityBlock,
  createAdminMedia,
  createAdminWithdrawalRequest,
  createAdminImageConsentEvent,
  createAdminDataRightsRequest,
  deleteAdminAvailabilityBlock,
  deleteAdminMedia,
  decideAdminRescheduleRequest,
  decideAdminWithdrawalRequest,
  getAdminAvailabilityBlocks,
  getAdminDataGovernance,
  getAdminMe,
  getAdminMedia,
  getAdminMessages,
  getAdminMessageRules,
  getAdminCatalogueBenefits,
  getAdminCatalogueTaxonomy,
  getAdminPackages,
  getAdminReservation,
  getApiHealth,
  loginAdmin,
  logoutAdmin,
  resolveAdminNotification,
  retryAdminNotification,
  rescheduleAdminReservation,
  syncAdminReservationCalendar,
  updateAdminMedia,
  updateAdminReservation,
  updateAdminAvailabilityBlock,
  updateAdminDataRightsRequest,
  verifyAdminPayment,
  verifyAndConfirmAdminReservation,
} from '../lib/api';
import {
  canConfirmReservation,
  canVerifyAndConfirm,
  isReservationEndReached,
  paymentActions,
  reservationActions,
  statusLabel,
} from '../lib/admin-workflow';
import { resetFormAfterSuccess } from '../lib/lead-submission';
import { isValidCameroonPhone, PHONE_INVALID_MESSAGE } from '../lib/contact-validation';
import { ADMIN_REFRESH_INTERVAL_MS, shouldRunAdminRefresh } from '../lib/admin-refresh';
import { adminRecordPath, adminTabFromPath, adminViewPath, parseAdminDestination } from '../lib/admin-deep-links';
import {
  businessDateTimeLocalValue,
  doualaLocalDateTimeToIso,
  formatBusinessDateTime,
} from '../lib/business-time';
import './AdminDashboard.css';

const AdminWhatsAppPanel = React.lazy(() => import('../components/AdminWhatsAppPanel'));
const AdminOpsPanel = React.lazy(() => import('../components/AdminReservationOperationsPanel'));
const AdminActionDialog = React.lazy(() => import('../components/AdminActionDialog'));
const AdminPackagesPanel = React.lazy(() => import('../components/AdminPackagesPanel'));
const AdminCatalogueSectionsPanel = React.lazy(() => import('../components/AdminCatalogueSectionsPanel'));
const AdminDataGovernancePanel = React.lazy(() => import('../components/AdminDataGovernancePanel'));
const AdminMediaRightsPanel = React.lazy(() => import('../components/AdminMediaRightsPanel'));
const AdminFinanceRoute = React.lazy(() => import('../components/AdminFinanceRoute'));
const AdminDeepLinkResolver = React.lazy(() => import('../components/AdminDeepLinkResolver'));
const AdminRequestsPanel = React.lazy(() => import('../components/AdminRequestsPanel'));
const AdminReservationRecord = React.lazy(() => import('../components/AdminReservationRecord'));
const AdminOverviewPanel = React.lazy(() => import('../components/AdminOverviewPanel'));
const AdminReservationsPanel = React.lazy(() => import('../components/AdminReservationsPanel'));
const AdminPlanningPanel = React.lazy(() => import('../components/AdminPlanningPanel'));
const AdminSettingsPanel = React.lazy(() => import('../components/AdminSettingsPanel'));
const AdminMessagesPanel = React.lazy(() => import('../components/AdminMessagesPanel'));
const AdminSecurityPanel = React.lazy(() => import('../components/AdminSecurityPanel'));

const dateTime = formatBusinessDateTime;


const latestCalendarSync = (reservation) => reservation?.calendarSync || reservation?.calendarSyncLogs?.[0] || null;





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
  const [totpCode, setTotpCode] = useState('');
  const [secondFactorRequired, setSecondFactorRequired] = useState(false);
  const [invitationPassword, setInvitationPassword] = useState('');
  const [invitationConfirmation, setInvitationConfirmation] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  // The active view lives in the URL, not in component state, so every view has its
  // own address and neither reload nor Back returns to the dashboard (§2.1).
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(
    () => adminTabFromPath(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const setActiveTab = useCallback((tab) => {
    if (adminTabFromPath(location.pathname, location.search) === tab) return;
    navigate(adminViewPath(tab));
  }, [location.pathname, location.search, navigate]);

  const recordDestination = useMemo(
    () => parseAdminDestination(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const invitationToken = useMemo(() => new URLSearchParams(location.search).get('invitation') || '', [location.search]);
  const isReservationRecordRoute = recordDestination?.area === 'reservations' && Boolean(recordDestination.reference);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loadedRes, setLoadedRes] = useState(null);
  // The open record is derived, never synchronised: leaving its address — including
  // with the browser Back button — closes it, with no effect and no extra render.
  const selectedRes = isReservationRecordRoute ? loadedRes : null;
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
  const leadCardRefs = useRef(new Map());

  const [financeDestinationId, setFinanceDestinationId] = useState('');
  const [packs, setPacks] = useState([]);
  const [media, setMedia] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [messageTemplatesMeta, setMessageTemplatesMeta] = useState(null);
  const [messageRules, setMessageRules] = useState([]);
  const [catalogueTaxonomy, setCatalogueTaxonomy] = useState([]);
  const [catalogueBenefits, setCatalogueBenefits] = useState([]);
  const [mediaIntegrity, setMediaIntegrity] = useState(null);
  const [dataGovernance, setDataGovernance] = useState({ policies: [], requests: [] });

  const refreshAdminTab = useCallback((tab, { reportError = true } = {}) => {
    const existingRequest = tabRefreshInFlightRef.current.get(tab);
    if (existingRequest) return existingRequest;

    setLoadingTabs((current) => ({ ...current, [tab]: true }));
    const request = (async () => {
      try {
        if (tab === 'overview' || tab === 'reservations' || tab === 'settings') {
          // Both views fetch what they need themselves, against the server-side
          // queries added in Phase 4. Nothing to refresh here is a success, not a
          // failure: returning undefined made callers report "données non rechargées".
          return true;
        } else if (tab === 'leads') {
          // The requests panel reads its own filters from the URL, like the journal does.
          return true;
        } else if (tab === 'finance') {
          // Same contract as above: the financial module reloads itself, and that is a
          // success. Returning undefined here made every refund action report a
          // spurious "les données n'ont pas pu être rechargées".
          return true;
        } else if (tab === 'tarifs') {
          // The catalogue is what this tab is for, so it is the only call allowed to fail
          // the refresh. Sections and privileges are additional panels: if either is
          // unavailable the formulas still list, rather than the whole tab going blank.
          setPacks(await getAdminPackages());
          const [sections, privileges] = await Promise.allSettled([
            getAdminCatalogueTaxonomy(), getAdminCatalogueBenefits(),
          ]);
          setCatalogueTaxonomy(sections.status === 'fulfilled' ? sections.value : []);
          setCatalogueBenefits(privileges.status === 'fulfilled' ? privileges.value : []);
        } else if (tab === 'availability') {
          setBlocks(await getAdminAvailabilityBlocks());
        } else if (tab === 'portfolio') {
          const library = await getAdminMedia();
          setMedia(library.items);
          setMediaIntegrity(library.meta?.integrity ?? null);
        } else if (tab === 'governance') {
          setDataGovernance(await getAdminDataGovernance());
        } else if (tab === 'notifications') {
          // The journal reads its own filters from the URL; only the library is shared.
          const [library, rules] = await Promise.all([getAdminMessages(), getAdminMessageRules()]);
          setMessageTemplates(library.items);
          setMessageTemplatesMeta(library.meta);
          setMessageRules(rules.items);
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
      if (activeTab === 'account') return;
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
      const admin = await loginAdmin({ email, password, ...(totpCode ? { totpCode } : {}) });
      setAdminUser(admin);
      setIsAuthenticated(true);
      setEmail('');
      setPassword('');
      setTotpCode('');
      setSecondFactorRequired(false);
      // Return to whatever was requested before the login screen appeared, not to the
      // dashboard. The URL was never navigated away from, so it still holds the target.
      await refreshAdminTab(adminTabFromPath(location.pathname, location.search));
    } catch (err) {
      if (err.code === 'TOTP_REQUIRED') {
        setSecondFactorRequired(true);
        setLoginError('Saisissez le code de votre application d’authentification ou un code de récupération.');
      } else {
        setLoginError(err.message || 'Connexion impossible. Identifiants incorrects.');
      }
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutAdmin();
    setIsAuthenticated(false);
    setAdminUser(null);
    setPacks([]);
    setMedia([]);
    setBlocks([]);
    setMessageTemplates([]);
    setDataGovernance({ policies: [], requests: [] });
    setLastSyncedAt({});
    tabRefreshInFlightRef.current.clear();
    setFeedback(null);
  };
  const handleInvitationAcceptance = async (event) => {
    event.preventDefault();
    setLoginError('');
    if (invitationPassword !== invitationConfirmation) {
      setLoginError('La confirmation du mot de passe ne correspond pas.');
      return;
    }
    setLoginSubmitting(true);
    try {
      const admin = await acceptAdminInvitation({ token: invitationToken, password: invitationPassword });
      setAdminUser(admin);
      setIsAuthenticated(true);
      setInvitationPassword('');
      setInvitationConfirmation('');
      navigate('/admin/securite', { replace: true });
    } catch (err) {
      setLoginError(err.message || 'Cette invitation ne peut pas être acceptée.');
    } finally {
      setLoginSubmitting(false);
    }
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

  const createDataRightsRequest = (payload) => runAction(
    'Création de la demande de droits',
    () => createAdminDataRightsRequest(payload),
  );

  const updateDataRightsRequest = (request, payload) => runAction(
    `Mise à jour de ${request.reference}`,
    () => updateAdminDataRightsRequest(request.id, payload),
  );

  const openReservation = async (reservation) => {
    const key = `reservations:detail:${reservation.id}`;
    setBusyActions((current) => ({ ...current, [key]: true }));
    try {
      const record = await getAdminReservation(reservation.id);
      setLoadedRes(record);
      // Give the open record its own address, so it can be reloaded, shared and
      // dismissed with Back (§2.1).
      const recordPath = adminRecordPath('reservations', record.reference);
      if (record.reference && location.pathname !== recordPath) navigate(recordPath);
    } catch (err) {
      setFeedback({ tab: 'reservations', type: 'error', message: err.message || 'Détails indisponibles.' });
    } finally {
      setBusyActions((current) => ({ ...current, [key]: false }));
    }
  };

  // Closing the record returns to the list URL it was opened from, so Back and the
  // close control agree with each other.
  const closeReservation = useCallback(() => {
    setLoadedRes(null);
    const destination = parseAdminDestination(location.pathname, location.search);
    if (destination?.area === 'reservations' && destination.reference) navigate(adminViewPath('reservations'));
  }, [location.pathname, location.search, navigate]);

  const openActionDialog = (config) => setActionDialog({ fields: [], ...config });

  const runDialogAction = async (label, action, refreshReservationId) => {
    const success = await runAction(label, action, true);
    if (!success) throw new Error('Cette action est déjà en cours.');
    if (refreshReservationId) setLoadedRes(await getAdminReservation(refreshReservationId));
  };

  const updateReservationStatus = async (reservation, status, action = {}) => {
    const scope = status === 'REJECTED' ? 'RESERVATION_REJECTION' : status === 'EXPIRED' ? 'RESERVATION_EXPIRATION' : status === 'CANCELLED' ? 'STUDIO_CANCELLATION' : null;
    const decisionTools = scope ? await import('../lib/admin-customer-decision') : null;
    const needsReason = action.temporalOverride || action.requiresReason || ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'].includes(status);
    const fields = status === 'CANCELLED' ? [{
      name: 'origin', label: 'Origine de l’annulation', type: 'select', required: true, defaultValue: 'CUSTOMER',
      options: [{ value: 'CUSTOMER', label: 'Client' }, { value: 'STUDIO', label: 'Studio' }],
    }] : [];
    if (scope) fields.push(...decisionTools.customerDecisionFields(scope));
    else if (needsReason) fields.push({ name: 'reason', label: 'Motif interne', type: 'textarea', required: true });
    const label = action.label || statusLabel(status);
    openActionDialog({
      title: action.temporalOverride ? 'Confirmer une dérogation temporelle' : 'Mettre à jour la réservation',
      summary: reservation.reference + ' · ' + statusLabel(reservation.status) + ' → ' + label,
      consequence: scope ? 'La note interne reste privée. Seul le message prévisualisé sera transmis au client.' : action.temporalOverride ? 'La clôture anticipée et son motif seront audités.' : 'Le statut, le motif et l’auteur seront inscrits dans l’historique.',
      confirmLabel: label,
      destructive: Boolean(action.destructive || action.temporalOverride),
      fields,
      ...(scope ? { preview: (values) => decisionTools.previewDecision(scope, reservation.id, values), previewRequired: status === 'CANCELLED' ? (values) => values.origin === 'STUDIO' : undefined } : {}),
      onConfirm: (values) => runDialogAction('Mise à jour de la réservation', async () => {
        if (status === 'CANCELLED') {
          await cancelAdminReservation(reservation.id, { commandId: window.crypto.randomUUID(), expectedVersion: reservation.version, origin: values.origin, internalReason: values.internalReason.trim(), customerReasonCode: values.customerReasonCode, customerReasonText: values.customerReasonText?.trim() || undefined });
          return;
        }
        const versioned = ['CONFIRMED', 'REJECTED', 'COMPLETED', 'NO_SHOW'].includes(status);
        await updateAdminReservation(reservation.id, {
          status,
          ...(scope ? { internalReason: values.internalReason.trim(), customerReasonCode: values.customerReasonCode, customerReasonText: values.customerReasonText?.trim() || undefined } : { reason: values.reason?.trim() || undefined }),
          ...(versioned ? { commandId: window.crypto.randomUUID(), expectedVersion: reservation.version } : {}),
          ...(action.temporalOverride ? { temporalOverride: true, overrideConfirmed: true } : {}),
        });
      }, reservation.id),
    });
  };

  const updateFirstPayment = async (reservation, action) => {
    const payment = reservation.payments?.[0];
    if (!payment) { setFeedback({ tab: 'reservations', type: 'error', message: 'Aucun paiement associé à cette réservation.' }); return; }
    const scope = action.status === 'REJECTED' ? 'PAYMENT_REJECTION' : action.status === 'PAYMENT_INFO_REQUIRED' ? 'PAYMENT_INFORMATION_REQUEST' : action.status === 'VERIFICATION_BLOCKED' ? 'PAYMENT_VERIFICATION_BLOCKAGE' : null;
    const decisionTools = scope ? await import('../lib/admin-customer-decision') : null;
    const fields = [];
    if (action.requiresTransactionReference) fields.push({ name: 'transactionRef', label: 'Référence de transaction', required: true, defaultValue: payment.transactionRef || '' });
    if (scope) fields.push(...decisionTools.customerDecisionFields(scope));
    else if (action.requiresReason) fields.push({ name: 'reason', label: 'Motif interne', type: 'textarea', required: true });
    openActionDialog({
      title: 'Décision de paiement', summary: reservation.reference + ' · ' + action.label,
      consequence: scope ? 'La note interne reste privée. Seul le message prévisualisé sera transmis au client.' : 'La décision sera versionnée et auditée.', confirmLabel: action.label,
      destructive: Boolean(action.destructive), fields,
      ...(scope ? { preview: (values) => decisionTools.previewDecision(scope, payment.id, values) } : {}),
      onConfirm: (values) => runDialogAction('Décision de paiement', () => verifyAdminPayment(payment.id, {
        status: action.status,
        ...(scope ? { internalReason: values.internalReason.trim(), customerReasonCode: values.customerReasonCode, customerReasonText: values.customerReasonText?.trim() || undefined } : { reason: values.reason?.trim() || undefined }),
        transactionRef: values.transactionRef?.trim() || undefined, commandId: window.crypto.randomUUID(), expectedVersion: payment.version,
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
    if (success) setLoadedRes(await getAdminReservation(reservation.id));
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

  const decideRescheduleRequest = async (reservation, request, decision) => {
    const accepted = decision === 'ACCEPTED';
    const decisionTools = !accepted ? await import('../lib/admin-customer-decision') : null;
    openActionDialog({
      title: accepted ? 'Accepter la demande de report' : 'Refuser la demande de report',
      summary: reservation.reference + ' · ' + dateTime(request.oldStartAt) + ' → ' + dateTime(request.requestedStartAt),
      consequence: accepted ? 'Le créneau sera déplacé après revalidation.' : 'Le créneau initial restera inchangé.',
      confirmLabel: accepted ? 'Accepter le report' : 'Refuser le report', destructive: !accepted,
      fields: accepted ? [{ name: 'internalReason', label: 'Note interne privée', type: 'textarea', required: true }] : decisionTools.customerDecisionFields('RESCHEDULE_REJECTION'),
      ...(!accepted ? { preview: (values) => decisionTools.previewDecision('RESCHEDULE_REJECTION', request.id, values) } : {}),
      onConfirm: (values) => runDialogAction('Décision de report', () => decideAdminRescheduleRequest(request.id, {
        commandId: window.crypto.randomUUID(), expectedVersion: request.version, decision, internalReason: values.internalReason.trim(),
        ...(!accepted ? { customerReasonCode: values.customerReasonCode, customerReasonText: values.customerReasonText?.trim() || undefined } : {}),
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

  const decideWithdrawalRequest = async (reservation, request, decision) => {
    const accepted = decision === 'ACCEPTED';
    const decisionTools = !accepted ? await import('../lib/admin-customer-decision') : null;
    openActionDialog({
      title: accepted ? 'Accepter la demande de rétractation' : 'Refuser la demande de rétractation',
      summary: reservation.reference + ' · reçue ' + dateTime(request.receivedAt),
      consequence: 'La décision motivée sera auditée. L’annulation et tout remboursement restent des opérations séparées.',
      confirmLabel: accepted ? 'Accepter la rétractation' : 'Refuser la rétractation',
      destructive: !accepted,
      fields: accepted ? [{ name: 'internalReason', label: 'Analyse interne privée', type: 'textarea', required: true }] : decisionTools.customerDecisionFields('WITHDRAWAL_REJECTION', 4000),
      onConfirm: (values) => runDialogAction('Décision de rétractation', () => decideAdminWithdrawalRequest(request.id, {
        commandId: window.crypto.randomUUID(), expectedVersion: request.version, decision, internalReason: values.internalReason.trim(),
        ...(!accepted ? { customerReasonCode: values.customerReasonCode, customerReasonText: values.customerReasonText?.trim() || undefined } : {}),
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

  // The planning panel creates a block through the shared action dialog, like every
  // other scheduling change, instead of a bare inline form.
  const createBlockDialog = (preset = {}) => openActionDialog({
    title: 'Bloquer un créneau',
    summary: preset.date ? `Indisponibilité du ${preset.date}` : 'Indisponibilité ponctuelle du studio',
    consequence: 'Les créneaux couverts disparaîtront immédiatement de la disponibilité publique.',
    confirmLabel: 'Bloquer ces créneaux',
    fields: [
      { name: 'startAt', label: 'Début à Douala', type: 'datetime-local', required: true, defaultValue: preset.date && preset.startAt ? `${preset.date}T${preset.startAt}` : '' },
      { name: 'endAt', label: 'Fin à Douala', type: 'datetime-local', required: true, defaultValue: preset.date && preset.endAt ? `${preset.date}T${preset.endAt}` : '' },
      { name: 'reason', label: 'Raison / motif', defaultValue: '' },
    ],
    onConfirm: async (values) => {
      let startAt; let endAt;
      try { startAt = doualaLocalDateTimeToIso(values.startAt); endAt = doualaLocalDateTimeToIso(values.endAt); }
      catch { throw new Error('Les dates du blocage sont invalides.'); }
      await runDialogAction('Blocage calendrier', () => createAdminAvailabilityBlock({
        startAt, endAt, reason: values.reason.trim() || undefined,
      }));
    },
  });

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
        <div style={{ color: 'var(--dark-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
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
          <h2>{invitationToken ? <>Activation du <span>compte</span></> : <>Espace <span>Admin</span></>}</h2>
          {invitationToken ? <form onSubmit={handleInvitationAcceptance} aria-describedby={loginError ? 'admin-login-error' : undefined}>
            <p style={{ color: 'var(--dark-secondary)', marginBottom: '1.25rem' }}>Choisissez le mot de passe de ce compte invité. Il doit contenir au moins 12 caractères.</p>
            <label htmlFor="admin-invitation-password" className="sr-only">Mot de passe</label>
            <input id="admin-invitation-password" autoComplete="new-password" type="password" placeholder="Nouveau mot de passe" className="form-input admin-login-input" value={invitationPassword} onChange={(e) => setInvitationPassword(e.target.value)} minLength={12} required />
            <label htmlFor="admin-invitation-confirmation" className="sr-only">Confirmation du mot de passe</label>
            <input id="admin-invitation-confirmation" autoComplete="new-password" type="password" placeholder="Confirmer le mot de passe" className="form-input admin-login-input" value={invitationConfirmation} onChange={(e) => setInvitationConfirmation(e.target.value)} minLength={12} required />
            {loginError && <p id="admin-login-error" role="alert" style={{ color: '#ff8787', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{loginError}</p>}
            <button className="btn btn-primary" style={{ width: '100%', padding: '1rem' }} disabled={loginSubmitting}>{loginSubmitting ? 'Activation en cours...' : 'Activer mon compte'}</button>
          </form> : <form onSubmit={handleLogin} aria-describedby={loginError ? 'admin-login-error' : undefined}>
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
            {secondFactorRequired && <>
              <label htmlFor="admin-totp-code" className="sr-only">Code de double authentification</label>
              <input id="admin-totp-code" name="totpCode" autoComplete="one-time-code" inputMode="numeric" placeholder="Code à 6 chiffres ou récupération" className="form-input admin-login-input" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} required />
            </>}
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
                  color: 'var(--dark-muted)',
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
          </form>}
        </Motion.div>
      </div>
    );
  }

  const nav = [
    ['overview', 'Vue ensemble', Calendar],
    ['reservations', 'Réservations', Users],
    ['leads', 'Demandes reçues', Briefcase],
    ['finance', 'Paiements', DollarSign],
    ['tarifs', 'Tarifs', DollarSign],
    ...(adminUser?.role === 'OWNER' ? [['availability', 'Disponibilités', Ban]] : []),
    ['portfolio', 'Portfolio', ImageIcon],
    ['notifications', 'Communications', Mail],
    ...(adminUser?.role === 'OWNER' ? [['settings', 'Paramètres', Settings]] : []),
    ...(adminUser?.role === 'OWNER' ? [['governance', 'Données & droits', ShieldCheck]] : []),
    ['account', 'Sécurité', KeyRound],
  ];

  // The record's action row, kept verbatim from the previous modal so every guard,
  // permission check and label survives the §3.1 restructure unchanged.
  const renderReservationActions = () => (
    <>
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
    </>
  );

  const closeSidebar = ({ restoreFocus = false } = {}) => {
    setIsSidebarOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => sidebarToggleRef.current?.focus());
    }
  };

  return (
    <div className="admin-layout">
      <React.Suspense fallback={null}>
        <AdminDeepLinkResolver
          adminRole={adminUser?.role}
          loadedReference={loadedRes?.reference}
          feedback={setFeedback}
          setReservation={setLoadedRes}
          setFinance={setFinanceDestinationId}
        />
      </React.Suspense>
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
      {activeTab !== 'account' && (
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
      )}
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
            <Motion.div key="overview" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement du tableau de bord…</div>}>
                <AdminOverviewPanel apiStatus={apiStatus} />
              </React.Suspense>
            </Motion.div>
          )}
          {activeTab === 'account' && (
            <Motion.div key="account" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement de la sécurité…</div>}>
                <AdminSecurityPanel adminUser={adminUser} onAdminUserChange={setAdminUser} onFeedback={setFeedback} />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'reservations' && (
            <Motion.div key="reservations" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement des réservations…</div>}>
                <AdminReservationsPanel onOpenReservation={openReservation} busyActions={busyActions} />
              </React.Suspense>
            </Motion.div>
          )}

          {/* Staff reach the verification file; the refunds file gates itself on the role. */}
          {activeTab === 'finance' && (
            <AdminFinanceRoute
              subview={recordDestination?.subview ?? 'verification'}
              canManageRefunds={adminUser?.role === 'OWNER'}
              destinationId={financeDestinationId}
              busy={Boolean(busyActions['finance:Engagement du remboursement'] || busyActions['finance:Finalisation du remboursement'] || busyActions['finance:Enregistrement du montant reçu'] || busyActions['finance:Marquage de doublon'])}
              openActionDialog={openActionDialog}
              runAction={runAction}
              setFeedback={setFeedback}
            />
          )}

          {activeTab === 'leads' && (
            <Motion.div key="leads" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement des demandes...</div>}>
                <AdminRequestsPanel
                  refreshToken={lastSyncedAt.leads}
                  cardRefs={leadCardRefs}
                  openActionDialog={openActionDialog}
                  runAction={runAction}
                />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'tarifs' && (
            <Motion.div key="tarifs" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement des tarifs...</div>}>
                <AdminPackagesPanel
                  packs={packs}
                  taxonomy={catalogueTaxonomy}
                  adminUser={adminUser}
                  onRefresh={() => refreshAdminTab('tarifs')}
                  onFeedback={setFeedback}
                />
                <AdminCatalogueSectionsPanel
                  taxonomy={catalogueTaxonomy}
                  benefits={catalogueBenefits}
                  onRefresh={() => refreshAdminTab('tarifs')}
                  onFeedback={setFeedback}
                />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'availability' && adminUser?.role === 'OWNER' && (
            <Motion.div key="availability" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement du planning…</div>}>
                <AdminPlanningPanel
                  openActionDialog={openActionDialog}
                  runAction={runAction}
                  blocks={blocks}
                  onCreateBlock={createBlockDialog}
                  onEditBlock={editBlock}
                  onDeleteBlock={removeAvailabilityBlock}
                />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'availability' && adminUser?.role !== 'OWNER' && (
            <Motion.div key="availability-forbidden" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <div className="admin-feedback error" role="alert">
                Les disponibilités et les règles de réservation sont réservées au compte propriétaire.
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
              <React.Suspense fallback={<div className="admin-status-banner">Chargement du registre des droits médias…</div>}>
                <AdminMediaRightsPanel
                  media={media}
                  integrity={mediaIntegrity}
                  onReorder={() => refreshAdminTab('portfolio')}
                  adminUser={adminUser}
                  onCreate={createMedia}
                  onToggle={toggleMediaFlag}
                  onRemove={removeMediaItem}
                />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'settings' && adminUser?.role === 'OWNER' && (
            <Motion.div key="settings" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement des paramètres…</div>}>
                <AdminSettingsPanel openActionDialog={openActionDialog} runAction={runAction} />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'governance' && adminUser?.role === 'OWNER' && (
            <Motion.div
              key="governance"
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <React.Suspense fallback={<div className="admin-status-banner">Chargement du registre confidentiel…</div>}>
                <AdminDataGovernancePanel
                  governance={dataGovernance}
                  dateTime={dateTime}
                  busy={Boolean(busyActions['governance:Création de la demande de droits']) || Object.keys(busyActions).some((key) => key.startsWith('governance:Mise à jour'))}
                  onCreate={createDataRightsRequest}
                  onUpdate={updateDataRightsRequest}
                />
              </React.Suspense>
            </Motion.div>
          )}

          {activeTab === 'notifications' && (
            <Motion.div key="notifications" variants={pageTransition} initial="initial" animate="animate" exit="exit">
              <React.Suspense fallback={<div className="admin-card">Chargement des messages…</div>}>
                <AdminMessagesPanel
                  refreshToken={lastSyncedAt.notifications}
                  templates={messageTemplates}
                  templatesMeta={messageTemplatesMeta}
                  rules={messageRules}
                  onReloadTemplates={async (locale = 'fr') => {
                    const [library, rules] = await Promise.all([getAdminMessages(locale), getAdminMessageRules()]);
                    setMessageTemplates(library.items);
                    setMessageTemplatesMeta(library.meta);
                    setMessageRules(rules.items);
                  }}
                  openActionDialog={openActionDialog}
                  runAction={runAction}
                  onResolve={classifyNotification}
                  onRetry={retryNotification}
                  busyActions={busyActions}
                />
              </React.Suspense>
            </Motion.div>
          )}
        </AnimatePresence>
      </main>

      {actionDialog && (
        <React.Suspense fallback={null}>
          <AdminActionDialog config={actionDialog} onClose={() => setActionDialog(null)} />
        </React.Suspense>
      )}

      {/* Reservation record (§3.1), addressed by its own URL and rendered by AdminReservationRecord. */}
      <AnimatePresence>
        {selectedRes && (
          <div className="admin-modal-backdrop" onClick={closeReservation}>
            <Motion.div
              className="admin-modal-content admin-record"
              tabIndex="-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <button onClick={closeReservation} className="admin-modal-close" type="button" aria-label="Fermer la fenêtre">&times;</button>
              <React.Suspense fallback={<p className="admin-record-empty">Chargement du dossier…</p>}>
                <AdminReservationRecord
                  reservation={selectedRes}
                  payment={selectedPayment}
                  busy={reservationDecisionBusy}
                  ownerDisabled={ownerDecisionDisabled}
                  endReached={selectedEndReached}
                  busyActions={busyActions}
                  actions={{
                    onPublished: () => getAdminReservation(selectedRes.id).then(setLoadedRes),
                    onRescheduleDecision: (request, decision, reason) => decideRescheduleRequest(selectedRes, request, decision, reason),
                    onWithdrawalDecision: (request, decision) => decideWithdrawalRequest(selectedRes, request, decision),
                    onImageConsentRecord: (choice, current) => recordImageConsentChoice(selectedRes, choice, current),
                    onRetryNotification: retryNotification,
                    renderActions: renderReservationActions,
                  }}
                />
              </React.Suspense>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
