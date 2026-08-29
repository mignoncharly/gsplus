import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getAdminFinancialTask, getAdminLead, getAdminLeads, getAdminReservation } from '../lib/api';
import { parseAdminDestination } from '../lib/admin-deep-links';
import './AdminDeepLinkResolver.css';

const focusWhenReady = (selector) => {
  const focus = () => {
    const element = document.querySelector(selector);
    if (!element) return false;
    element.focus();
    return true;
  };
  if (focus()) return;
  const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10_000);
};

const AdminDeepLinkResolver = ({
  adminRole,
  loadedReference,
  reservationRef: reservationSearchReferenceRef,
  feedback: setFeedback,
  setQuery: setReservationReferenceQuery,
  setResults: setReservationSearchResults,
  setReservation: setSelectedRes,
  setLeadItems: setLeads,
  setFinance: setFinanceDestinationId,
}) => {
  const location = useLocation();
  const resolvedLocationRef = useRef('');

  useEffect(() => {
    const locationKey = location.pathname + location.search;
    if (resolvedLocationRef.current === locationKey) return;
    const destination = parseAdminDestination(location.pathname, location.search);
    // The dashboard derives the active view from the same URL, so this resolver only
    // has to load the record a path carries. A view-only path needs nothing here.
    if (!destination?.area || !destination.reference) return;
    // Opening a record from the list already fetched it and then changed the URL.
    // Re-fetching here would duplicate the request and flash the deep-link progress
    // message on an ordinary click, so the already-loaded record is left alone.
    const sameRecord = destination.area === 'reservations'
      && loadedReference
      && String(loadedReference).toUpperCase() === String(destination.reference).toUpperCase();
    if (sameRecord) {
      resolvedLocationRef.current = locationKey;
      return;
    }
    resolvedLocationRef.current = locationKey;
    let cancelled = false;
    const resolve = async () => {
      const tab = destination.tab;
      setFeedback({ tab, type: 'progress', message: 'Ouverture de la destination sécurisée...' });
      try {
        if (destination.area === 'reservations') {
          const reservation = await getAdminReservation(destination.reference);
          if (cancelled) return;
          reservationSearchReferenceRef.current = reservation.reference;
          setReservationReferenceQuery(reservation.reference);
          setReservationSearchResults([reservation]);
          setSelectedRes(reservation);
        } else if (destination.area === 'leads') {
          const lead = await getAdminLead(destination.reference);
          const currentLeads = await getAdminLeads();
          if (cancelled) return;
          setLeads([lead, ...currentLeads.filter((item) => item.id !== lead.id)]);
        } else {
          if (adminRole !== 'OWNER') throw new Error('Cette destination financière nécessite le rôle propriétaire.');
          await getAdminFinancialTask(destination.reference);
          if (cancelled) return;
          setFinanceDestinationId(destination.reference);
        }
        if (destination.area !== 'finance') {
          setFeedback(null);
          const selector = destination.area === 'reservations' ? '.admin-modal-content' : '[data-lead-reference="' + destination.reference + '"]';
          window.requestAnimationFrame(() => focusWhenReady(selector));
        }
      } catch (error) {
        if (!cancelled) setFeedback({ tab, type: 'error', message: error.message || 'Destination introuvable ou obsolète.' });
      }
    };
    void resolve();
    return () => {
      cancelled = true;
      if (resolvedLocationRef.current === locationKey) resolvedLocationRef.current = '';
    };
  }, [adminRole, loadedReference, location.pathname, location.search, reservationSearchReferenceRef, setFeedback, setFinanceDestinationId, setLeads, setReservationReferenceQuery, setReservationSearchResults, setSelectedRes]);

  return null;
};

export default AdminDeepLinkResolver;
