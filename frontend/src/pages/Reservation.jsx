import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  User, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle, 
  Check, 
  Sparkles, 
  MessageSquare, 
  AlertTriangle, 
  Send, 
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  ChevronDown
} from 'lucide-react';
import { createReservation, createReservationIntent, getAvailability, getPackages } from '../lib/api';
import {
  addBusinessDays,
  businessDateKey,
  businessDateLabelParts,
  formatBusinessDateKey,
} from '../lib/business-time';
import { formatFcfa } from '../lib/display-formatters';
import { packageView, selectPackageFromQuery } from '../lib/packages';
import { createLatestRequestGate } from '../lib/latest-request';
import { validateContactFields, validationErrorsFromApi } from '../lib/contact-validation';
import {
  packageSelectionDisabledReason,
  paymentSubmissionDisabledReason,
  slotSelectionDisabledReason,
} from '../lib/disabled-actions';
import { FRENCH_VALIDATION_SUMMARY, validationSummaryForApiError } from '../lib/form-errors';
import { bookingMessages, useLocale } from '../lib/i18n.js';
import ActionAvailabilityHint from '../components/ActionAvailabilityHint';
import './Reservation.css';

const ReservationConsentFields = React.lazy(() => import('../components/ReservationConsentFields'));



const stepTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
};

const Reservation = () => {
  const { locale } = useLocale();
  const copy = bookingMessages[locale];
  const [searchParams] = useSearchParams();
  const initialPackId = searchParams.get('pack');
  const [packs, setPacks] = useState([]);
  const t = (fr, en) => locale === 'en' ? en : fr;
  const [packsLoading, setPacksLoading] = useState(true);
  const [availabilityDays, setAvailabilityDays] = useState([]);
  const [reservationResult, setReservationResult] = useState(null);
  const [submittingReservation, setSubmittingReservation] = useState(false);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ 
    packageId: '',
    packName: '', 
    packPrice: 0, 
    isPromo: false,
    packIsRange: false,
    packDuration: 60,
    packDurationLabel: '',
    date: '', time: '',
    startAt: '',
    lastName: '', firstName: '', phone: '', email: '', 
    birthDate: '', gender: '', discoveryChannel: '', extraInfo: '', 
    consent: false,
    whatsappConsent: false,
    whatsappMarketingConsent: false,
    acceptCGV: false,
    acceptPrivacy: false,
    transactionId: '',
    paymentMethod: 'mtn_momo',
    paymentPhone: '',
    paymentChoice: 'base'
  });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [bookingMode, setBookingMode] = useState('calendar'); // 'calendar' | 'free'
  const [reservationIntent, setReservationIntent] = useState(null);
  const [slotVerification, setSlotVerification] = useState(null);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [suggestions, setSuggestions] = useState([]);
  const [freeDate, setFreeDate] = useState('');
  const [freeTime, setFreeTime] = useState('');
  const [checkResult, setCheckResult] = useState(null);
  const [minFreeDate] = useState(() => addBusinessDays(businessDateKey(), 1));
  const slotRequestGate = useRef(createLatestRequestGate());
  const slotRequestInFlight = useRef(false);
  useEffect(() => {
    let isMounted = true;
    getPackages()
      .then((items) => {
        if (!isMounted) return;
        const normalized = items.map((item) => packageView(item, locale)).filter((pack) => pack.isDirectBooking);
        const selected = selectPackageFromQuery(normalized, initialPackId);
        setPacks(normalized);
        if (selected) setFormData((current) => ({
          ...current, packageId: selected.id, packName: selected.name, packPrice: selected.price,
          isPromo: selected.isPromo, packIsRange: selected.isRange, packDuration: selected.durationMin,
          packDurationLabel: selected.durationLabel,
        }));
      })
      .catch(() => { if (isMounted) setError(copy.packageLoadFailed); })
      .finally(() => { if (isMounted) setPacksLoading(false); });
    return () => { isMounted = false; };
  }, [copy.packageLoadFailed, initialPackId, locale]);

  useEffect(() => {
    if (!formData.packageId) return undefined;
    let isMounted = true;
    const from = addBusinessDays(businessDateKey(), 1);
    const to = addBusinessDays(from, 29);
    getAvailability({ from, to, packageId: formData.packageId })
      .then((availability) => { if (isMounted) setAvailabilityDays(availability.days || []); })
      .catch(() => { if (isMounted) { setError(copy.availabilityLoadFailed); setAvailabilityDays([]); } });
    return () => { isMounted = false; };
  }, [copy.availabilityLoadFailed, formData.packageId]);
  const JOURS = copy.days;
  const MOIS = copy.months;

  const availableDays = availabilityDays.filter((day) => !day.isClosed && day.slots.length > 0).slice(0, 21);
  const expectedSlotVerification = `${bookingMode}:${formData.date}:${formData.time}`;
  const packageDisabledReason = packageSelectionDisabledReason({
    locale,
    loading: packsLoading,
    packageCount: packs.length,
    packageId: formData.packageId,
  });
  const slotDisabledReason = slotSelectionDisabledReason({
    locale,
    date: formData.date,
    time: formData.time,
    checking: checkingSlot,
    verified: slotVerification === expectedSlotVerification,
  });
  const paymentDisabledReason = paymentSubmissionDisabledReason({
    locale,
    submitting: submittingReservation,
    paymentChoice: formData.paymentChoice,
    paymentPhone: formData.paymentPhone,
    transactionId: formData.transactionId,
  });

  const buildReservationPayload = () => ({
    intentId: reservationIntent?.id,
    idempotencyKey,
    customer: {
      firstName: formData.firstName,
      lastName: formData.lastName,
      phone: formData.phone,
      email: formData.email,
      birthDate: formData.birthDate || undefined,
      gender: formData.gender,
      discoveryChannel: formData.discoveryChannel || undefined,
    },
    consentImage: formData.consent,
    whatsappConsent: formData.whatsappConsent,
    whatsappMarketingConsent: formData.whatsappMarketingConsent,
    acceptedTerms: formData.acceptCGV,
    acceptedPrivacy: formData.acceptPrivacy,
    paymentChoice: formData.paymentChoice,
    paymentMethod: formData.paymentChoice === 'base' ? formData.paymentMethod : undefined,
    paymentPhone: formData.paymentChoice === 'base' ? formData.paymentPhone : undefined,
    transactionRef: formData.paymentChoice === 'base' ? formData.transactionId : undefined,
    extraInfo: formData.extraInfo || undefined,
    website: '',
  });

  const clearFieldError = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const nextStep = async () => {
    setError('');

    if (submittingReservation) return;
    
    if (step === 2) {
      const selectionKey = `${bookingMode}:${formData.date}:${formData.time}`;
      if (!reservationIntent || slotVerification !== selectionKey) {
        setError(copy.slotMustVerify);
        return;
      }
    }

    if (step === 3) {
      const contactErrors = validateContactFields({
        phone: formData.phone,
        email: formData.email,
        phoneRequired: true,
        emailRequired: true,
        locale,
      });
      const profileErrors = {
        ...(!formData.lastName ? { lastName: copy.lastNameRequired } : {}),
        ...(!formData.firstName ? { firstName: copy.firstNameRequired } : {}),
        ...(!formData.gender ? { gender: copy.genderRequired } : {}),
        ...contactErrors,
        ...(!formData.acceptCGV ? { acceptedTerms: copy.termsRequired } : {}),
        ...(!formData.acceptPrivacy ? { acceptedPrivacy: copy.privacyRequired } : {}),
        ...(formData.isPromo && !formData.consent
          ? { consentImage: copy.imageConsentRequired }
          : {}),
      };
      setFieldErrors((current) => {
        const next = { ...current };
        for (const field of ['lastName', 'firstName', 'gender', 'phone', 'email', 'acceptedTerms', 'acceptedPrivacy', 'consentImage']) {
          delete next[field];
        }
        return { ...next, ...profileErrors };
      });
      if (Object.keys(profileErrors).length > 0) {
        setError(copy.validation);
        return;
      }
    }

    if (step === 4) {
      if (!reservationIntent) {
        setError(copy.holdExpired);
        return;
      }
      if (formData.paymentChoice === 'base') {
        const paymentContactErrors = validateContactFields({
          phone: formData.paymentPhone,
          phoneRequired: true,
          locale,
        });
        const paymentErrors = {
          ...(paymentContactErrors.phone ? { paymentPhone: paymentContactErrors.phone } : {}),
          ...(!formData.transactionId ? { transactionRef: copy.transactionRequired } : {}),
        };
        setFieldErrors((current) => {
          const next = { ...current };
          delete next.paymentPhone;
          delete next.transactionRef;
          return { ...next, ...paymentErrors };
        });
        if (Object.keys(paymentErrors).length > 0) {
          setError(copy.validation);
          return;
        }
      }

      setSubmittingReservation(true);
      try {
        const reservation = await createReservation(buildReservationPayload());
        setReservationResult(reservation);
      } catch (err) {
        const apiFields = validationErrorsFromApi(err, {
          'customer.firstName': 'firstName',
          'customer.lastName': 'lastName',
          'customer.phone': 'phone',
          'customer.email': 'email',
          'customer.gender': 'gender',
          acceptedTerms: 'acceptedTerms',
          acceptedPrivacy: 'acceptedPrivacy',
          consentImage: 'consentImage',
          paymentMethod: 'paymentMethod',
          paymentPhone: 'paymentPhone',
          transactionRef: 'transactionRef',
        }, locale);
        if (Object.keys(apiFields).length > 0) {
          setFieldErrors((current) => ({ ...current, ...apiFields }));
          if (apiFields.firstName || apiFields.lastName || apiFields.phone || apiFields.email ||
              apiFields.gender || apiFields.acceptedTerms || apiFields.acceptedPrivacy || apiFields.consentImage) setStep(3);
        }
        setError(validationSummaryForApiError(err, locale) || copy.bookingFailed);
        return;
      } finally {
        setSubmittingReservation(false);
      }
    }
    
    setStep(s => s + 1);
  };
  
  const prevStep = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handlePackChange = (e) => {
    const selected = packs.find(p => p.id === e.target.value || p.name === e.target.value);
    if (!selected) return;

    invalidateSlotRequest();
    setFormData({
      ...formData, 
      packageId: selected.id,
      packName: selected.name, 
      packPrice: selected.price, 
      isPromo: selected.isPromo,
      packIsRange: selected.isRange,
      packDuration: selected.durationMin,
      packDurationLabel: selected.durationLabel,
      date: '',
      time: '',
      startAt: '',
      transactionId: '',
      paymentMethod: 'mtn_momo',
      paymentPhone: '',
      paymentChoice: 'base'
    });
    setReservationIntent(null);
    setSlotVerification(null);
    setCheckResult(null);
    setSuggestions([]);
  };

  const timeToMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const getEndTime = (startTime, durationMin) => {
    const totalMin = timeToMin(startTime) + durationMin;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getDayAvailability = (dateStr) => availabilityDays.find((day) => day.date === dateStr);

  const getAvailableSlots = (dateStr) => {
    const day = getDayAvailability(dateStr);
    if (!day || day.isClosed) return [];
    return day.slots;
  };

  const getUnavailableMessage = (reason, dateStr, timeStr) => {
    if (reason === 'reservation') return copy.unavailableReservation.replace('{time}', timeStr).replace('{date}', formatSelectedDate(dateStr));
    if (reason === 'reservation_intent') return copy.unavailableHold.replace('{time}', timeStr);
    if (reason === 'availability_block') return copy.unavailableBlock.replace('{time}', timeStr).replace('{date}', formatSelectedDate(dateStr));
    if (reason === 'closed') return copy.studioClosed;
    if (reason === 'missing') return copy.slotMissing;
    return copy.slotUnavailable;
  };
  const beginSlotRequest = () => {
    if (slotRequestInFlight.current) return null;
    slotRequestInFlight.current = true;
    const requestVersion = slotRequestGate.current.begin();
    setCheckingSlot(true);
    return requestVersion;
  };

  const finishSlotRequest = (requestVersion) => {
    if (!slotRequestGate.current.isCurrent(requestVersion)) return;
    slotRequestInFlight.current = false;
    setCheckingSlot(false);
  };

  const invalidateSlotRequest = () => {
    slotRequestGate.current.invalidate();
    slotRequestInFlight.current = false;
    setCheckingSlot(false);
  };

  const clearVerifiedSelection = () => {
    invalidateSlotRequest();
    setReservationIntent(null);
    setFormData((current) => ({ ...current, date: '', time: '', startAt: '' }));
    setSlotVerification(null);
    setCheckResult(null);
    setSuggestions([]);
  };

  const switchBookingMode = (mode) => {
    setBookingMode(mode);
    clearVerifiedSelection();
    setError('');
  };

  const selectCalendarDay = (date) => {
    invalidateSlotRequest();
    setFormData((current) => ({ ...current, date, time: '', startAt: '' }));
    setSlotVerification(null);
    setCheckResult(null);
    setError('');
  };

  const holdSlot = async (slot, date, mode, existingRequestVersion = null) => {
    const requestVersion = existingRequestVersion ?? beginSlotRequest();
    if (requestVersion === null || !slotRequestGate.current.isCurrent(requestVersion)) return false;
    setError('');
    setSlotVerification(null);
    setFormData((current) => ({ ...current, date, time: '', startAt: '' }));

    try {
      const intent = await createReservationIntent({
        idempotencyKey,
        packageId: formData.packageId,
        startAt: slot.startAt,
        website: '',
      });
      if (!slotRequestGate.current.isCurrent(requestVersion)) return false;
      setReservationIntent(intent);
      setFormData((current) => ({ ...current, date, time: slot.time, startAt: intent.startAt }));
      setSlotVerification(`${mode}:${date}:${slot.time}`);
      setCheckResult('available');
      return true;
    } catch (err) {
      setError(err.message || copy.slotUnavailable);
      setReservationIntent(null);
      setCheckResult('unavailable');
      setError(err.message || "Ce créneau n'est plus disponible. Veuillez en choisir un autre.");
      return false;
    } finally {
      finishSlotRequest(requestVersion);
    }
  };

  const findSuggestions = (requestedDate, requestedTime) => {
    const results = [];
    const requestedMin = timeToMin(requestedTime);
    const today = businessDateKey();
    
    for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
      const offsets = dayOffset === 0 ? [0] : [-dayOffset, dayOffset];
      for (const off of offsets) {
        const dateStr = addBusinessDays(requestedDate, off);
        if (dateStr <= today) continue;
        const daySlots = getAvailableSlots(dateStr).filter((slot) => slot.available);

        for (const slot of daySlots) {
          const slotMin = timeToMin(slot.time);
          const dayDiff = Math.abs(off);
          const timeDiff = Math.abs(slotMin - requestedMin);
          const totalDiff = dayDiff * 1440 + timeDiff; 
          results.push({ date: dateStr, time: slot.time, totalDiff, slot });
        }
      }
    }
    
    results.sort((a, b) => a.totalDiff - b.totalDiff);
    return results.slice(0, 3);
  };

  const handleFreeCheck = async () => {
    setError('');
    setCheckResult(null);
    setSlotVerification(null);
    setSuggestions([]);

    if (!freeDate || !freeTime) {
      setError(copy.dateTimeRequired);
      setCheckResult('unavailable');
      return;
    }
    if (freeDate <= businessDateKey()) {
      setError(copy.dateFuture);
      setCheckResult('unavailable');
      return;
    }

    const requestVersion = beginSlotRequest();
    if (requestVersion === null) return;
    const requestedDate = freeDate;
    const requestedTime = freeTime;

    try {
      const availability = await getAvailability({ from: requestedDate, to: requestedDate, packageId: formData.packageId });
      if (!slotRequestGate.current.isCurrent(requestVersion)) return;
      const day = availability.days?.[0];
      setAvailabilityDays((current) => [...current.filter((item) => item.date !== requestedDate), ...(day ? [day] : [])].sort((a, b) => a.date.localeCompare(b.date)));
      if (day?.isClosed) {
        setError(copy.studioClosed);
        setCheckResult('unavailable');
        return;
      }
      const exactSlot = day?.slots?.find((slot) => slot.time === requestedTime);
      if (!exactSlot) {
        setError(copy.exactSlotMissing);
        setSuggestions(findSuggestions(requestedDate, requestedTime));
        setCheckResult('unavailable');
        return;
      }
      const heldByThisFlow = reservationIntent?.startAt === exactSlot.startAt;
      if (!exactSlot.available && !heldByThisFlow) {
        setError(getUnavailableMessage(exactSlot.reason, requestedDate, requestedTime));
        setSuggestions(findSuggestions(requestedDate, requestedTime));
        setCheckResult('unavailable');
        return;
      }
      await holdSlot(exactSlot, requestedDate, 'free', requestVersion);
    } catch (err) {
      if (!slotRequestGate.current.isCurrent(requestVersion)) return;
      setCheckResult('unavailable');
      setError(err.message || copy.slotCheckFailed);
    } finally {
      finishSlotRequest(requestVersion);
    }
  };

  const selectSuggestion = async (sug) => {
    const slot = sug.slot || getAvailableSlots(sug.date).find((item) => item.time === sug.time);
    if (!slot) return;
    setFreeDate(sug.date);
    setFreeTime(sug.time);
    setSuggestions([]);
    await holdSlot(slot, sug.date, 'free');
  };

  const formatSelectedDate = formatBusinessDateKey;

  return (
    <div className="reservation-page">
      <div className="reservation-container">
        <h1 className="reservation-page-title">{t('Réserver une', 'Book a')} <span>{t('Séance', 'Session')}</span></h1>
        
        {/* Step Indicator Stepper */}
        {step < 5 && (
          <div className="booking-stepper" role="list" aria-label={t('Étapes de réservation', 'Booking steps')}>
            <div className="stepper-progress-line" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
            {[1, 2, 3, 4].map((s) => {
              const labels = locale === 'en' ? ['Package', 'Time slot', 'Profile', 'Payment'] : ['Formule', 'Créneau', 'Profil', 'Paiement'];
              const isActive = step === s;
              const isCompleted = step > s;
              return (
                <div key={s} role="listitem" aria-current={isActive ? 'step' : undefined} className={`stepper-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                  {isCompleted ? <Check size={15} /> : s}
                  <span className="stepper-label">{labels[s - 1]}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="glass-booking-card" aria-describedby={error ? 'booking-form-error' : undefined}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <Motion.div 
                key="step1"
                variants={stepTransition}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <h2 className="booking-step-title">{t('Sélectionnez votre formule', 'Select your package')}</h2>
                <div style={{ position: 'relative' }}>
                  <label htmlFor="booking-package" className="sr-only">{t('Formule de réservation', 'Booking package')}</label>
                  <select 
                    id="booking-package"
                    name="packageId"
                    aria-describedby={`booking-package-help${packageDisabledReason ? ' booking-package-disabled-help' : ''}`}
                    required
                   
                    className="form-input" 
                    style={{ width: '100%', padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }} 
                    value={formData.packName} 
                    onChange={handlePackChange} 
                    disabled={packsLoading || packs.length === 0}
                  >
                    {packsLoading && <option>{t('Chargement des packs...', 'Loading packages...')}</option>}
                    {!packsLoading && packs.map(p => (
                      <option key={p.name} value={p.name}>
                        {p.name} — {p.isRange ? t('À partir de ', 'From ') : ''}{formatFcfa(p.price)} ({p.durationLabel})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="booking-info-badge">
                  <Clock size={18} />
                  <span id="booking-package-help">{t('Durée de la séance : ', 'Session duration: ')}<strong>{formData.packDurationLabel || '60 Min'}</strong></span>
                </div>
                
                {formData.isPromo && (
                  <p style={{ color: 'var(--c-gold)', fontSize: '0.82rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    {t("* Cette formule est proposée sous condition d'autorisation d'utilisation des images. Les modalités sont présentées à l'étape 3.", '* This package requires image-use consent. The terms are presented at step 3.')}
                  </p>
                )}
                
                <div className="booking-helper-card">
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <HelpCircle size={20} className="text-gold" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                    <p style={{ margin: 0, lineHeight: 1.5 }}>
                      <strong>{t("Besoin d'aide pour choisir votre formule ?", 'Need help choosing your package?')}</strong><br />
                      {t('Notre équipe est disponible pour vous conseiller sur les décors et les formules. ', 'Our team can advise you on settings and packages. ')}<a href="https://wa.me/237673026654" target="_blank" rel="noopener noreferrer">{t('Discutez sur WhatsApp', 'Chat on WhatsApp')}</a>.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '2.5rem' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '1.25rem' }} 
                    onClick={nextStep} 
                    disabled={!formData.packageId}
                    aria-describedby={packageDisabledReason ? 'booking-package-disabled-help' : undefined}
                  >
                    {copy.continue} <ChevronRight size={16} />
                  </button>
                  <ActionAvailabilityHint id="booking-package-disabled-help" message={packageDisabledReason} />
                </div>
              </Motion.div>
            )}

            {step === 2 && (
              <Motion.div 
                key="step2"
                variants={stepTransition}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <h2 className="booking-step-title">{t('Choisissez votre créneau', 'Choose your time slot')}</h2>
                
                <div className="booking-info-badge" style={{ marginTop: 0, marginBottom: '2rem' }}>
                  <Sparkles size={18} />
                  <span>{t('Formule : ', 'Package: ')}<strong>{formData.packName}</strong> — {copy.duration} <strong>{formData.packDurationLabel}</strong></span>
                </div>

                {/* Segmented Mode Selector */}
                <div className="booking-mode-toggle" role="group" aria-label={t('Mode de sélection du créneau', 'Time-slot selection mode')}>
                  <button
                    type="button"
                    aria-pressed={bookingMode === 'calendar'}
                    className={`booking-mode-btn ${bookingMode === 'calendar' ? 'active' : ''}`}
                    onClick={() => switchBookingMode('calendar')}
                  >
                    <CalendarIcon size={16} /> {t('Disponibilités du studio', 'Studio availability')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={bookingMode === 'free'}
                    className={`booking-mode-btn ${bookingMode === 'free' ? 'active' : ''}`}
                    onClick={() => switchBookingMode('free')}
                  >
                    <MessageSquare size={16} /> {t('Proposer mon horaire', 'Suggest my time')}
                  </button>
                </div>

                {/* MODE CALENDRIER */}
                {bookingMode === 'calendar' && (
                  <div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
                      {t('Le studio est ouvert du lundi au samedi de 9 h à 18 h. Faites défiler les jours pour consulter les disponibilités.', 'The studio is open Monday to Saturday, 9:00 to 18:00. Browse the days to view availability.')}
                    </p>
                    
                    {/* Horizontal scroll Calendar */}
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-gold-light)', marginBottom: '1rem' }}>
                        {t('1. Sélectionner un jour', '1. Select a day')}
                      </h3>
                      <div className="horizontal-calendar-scroll">
                        {availableDays.map((day) => {
                          const dateStr = day.date;
                          const parts = businessDateLabelParts(dateStr);
                          const isSelected = formData.date === dateStr;
                          
                          return (
                            <button
                              key={dateStr}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => selectCalendarDay(dateStr)}
                              className={`date-card-btn ${isSelected ? 'active' : ''}`}
                            >
                              <span className="date-card-day">{JOURS[parts.dayOfWeek]}</span>
                              <span className="date-card-num">{parts.day}</span>
                              <span className="date-card-month">{MOIS[parts.month].substring(0, 3)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Slots Grid */}
                    {formData.date && (
                      <Motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ marginBottom: '2.5rem' }}
                      >
                        <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-gold-light)', marginBottom: '1rem' }}>
                          {t("2. Choisir l'heure de début — ", '2. Choose a start time — ')}{formatSelectedDate(formData.date)}
                        </h3>
                        
                        <div className="slots-legend">
                          <div className="legend-item">
                            <span className="legend-color" style={{ background: 'rgba(46, 204, 113, 0.1)', border: '1px dashed rgba(46, 204, 113, 0.4)' }}></span>
                            <span>{t('Disponible', 'Available')}</span>
                          </div>
                          <div className="legend-item">
                            <span className="legend-color" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}></span>
                            <span>{t('Indisponible — horaire barré', 'Unavailable — crossed out')}</span>
                          </div>
                          <div className="legend-item">
                            <span className="legend-color" style={{ background: 'var(--grad-gold)' }}></span>
                            <span>{t('Votre choix', 'Your selection')}</span>
                          </div>
                        </div>

                        <div className="slots-grid">
                          {getAvailableSlots(formData.date).map(slotInfo => {
                            const slot = slotInfo.time;
                            const unavailReason = slotInfo.available ? null : slotInfo.reason;
                            const isUnavail = !!unavailReason;
                            const isSelected = formData.time === slot;
                            
                            const title = unavailReason
                              ? getUnavailableMessage(unavailReason, formData.date, slot)
                              : `${slot} → ${slotInfo.endTime || getEndTime(slot, formData.packDuration)}`;
                            
                            return (
                              <button
                                key={slot}
                                type="button"
                                aria-pressed={isSelected}
                                aria-disabled={isUnavail || checkingSlot ? 'true' : undefined}
                                aria-label={isUnavail ? `${slot} — ${title}` : undefined}
                                disabled={checkingSlot}
                                title={title}
                                onClick={() => !isUnavail && holdSlot(slotInfo, formData.date, 'calendar')}
                                className={`slot-btn ${isSelected ? 'slot-selected' : isUnavail ? 'slot-reserved' : 'slot-available'}`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </Motion.div>
                    )}
                  </div>
                )}

                {/* MODE PROPOSITION LIBRE */}
                {bookingMode === 'free' && (
                  <div className="booking-free-wrap">
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
                      {t("Saisissez la date et l'heure idéales pour vous. Notre système interrogera instantanément l'agenda du studio.", 'Enter your ideal date and time. Our system will check the studio calendar instantly.')}
                    </p>

                    <div className="grid md:grid-cols-2 gap-6" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label htmlFor="booking-free-date" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Date souhaitée', 'Preferred date')}</label>
                        <input 
                          id="booking-free-date"
                          name="preferredDate"
                          type="date"
                          required 
                          className="form-input" 
                          value={freeDate} 
                          onChange={e => { setFreeDate(e.target.value); clearVerifiedSelection(); }}
                          min={minFreeDate}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label htmlFor="booking-free-time" style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Heure souhaitée', 'Preferred time')}</label>
                        <input 
                          id="booking-free-time"
                          name="preferredTime"
                          type="time"
                          required 
                          className="form-input" 
                          value={freeTime} 
                          onChange={e => { setFreeTime(e.target.value); clearVerifiedSelection(); }}
                          min="09:00" max="17:30" step="1800"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '1rem', marginBottom: '2rem' }}
                      onClick={handleFreeCheck}
                      disabled={checkingSlot}
                      aria-busy={checkingSlot}
                    >
                      {checkingSlot ? copy.checkingAvailability : copy.checkAvailability}
                    </button>

                    {/* Result Available */}
                    {checkResult === 'available' && (
                      <Motion.div 
                        className="check-result-available"
                        role="status"
                        aria-live="polite"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <CheckCircle2 size={36} style={{ color: '#2ecc71', flexShrink: 0 }} />
                        <div>
                          <h4>{t('Créneau Disponible !', 'Time slot available!')}</h4>
                          <p>
                            {formatSelectedDate(formData.date)} {copy.at} {formData.time} — {t('Fin prévue à ', 'Expected end: ')}{getEndTime(formData.time, formData.packDuration)} ({formData.packDurationLabel})
                          </p>
                        </div>
                      </Motion.div>
                    )}

                    {/* Result Unavailable */}
                    {checkResult === 'unavailable' && (
                      <Motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="check-result-unavailable">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <AlertTriangle size={20} style={{ color: '#e74c3c', flexShrink: 0 }} />
                            <h4>{t('Créneau Indisponible', 'Time slot unavailable')}</h4>
                          </div>
                          {error && <p>{error}</p>}
                        </div>

                        {suggestions.length > 0 && (
                          <div style={{ marginTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '0.9rem', color: 'var(--c-gold-light)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                              {t('Propositions alternatives proches :', 'Nearby alternatives:')}
                            </h3>
                            {suggestions.map((sug, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => selectSuggestion(sug)}
                                className="suggestion-btn"
                                disabled={checkingSlot}
                              >
                                <div>
                                  <strong>{formatSelectedDate(sug.date)}</strong>
                                  <span>{copy.from} {sug.time} {copy.timeTo} {getEndTime(sug.time, formData.packDuration)}</span>
                                </div>
                                <span className="suggestion-select-label">{t('Réserver', 'Book')}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </Motion.div>
                    )}
                  </div>
                )}

                {/* Selected Slot Recap (shared) */}
                {formData.date && formData.time && (
                  <div 
                    className="check-result-available" 
                    style={{ marginBottom: '2rem', background: 'rgba(197, 146, 58, 0.04)', borderColor: 'rgba(197, 146, 58, 0.2)' }}
                  >
                    <CheckCircle2 size={24} style={{ color: 'var(--c-gold)', flexShrink: 0 }} />
                    <div>
                      <h4 style={{ color: 'var(--c-gold-light)' }}>{copy.scheduledSession}</h4>
                      <p style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {copy.sessionOn}<strong>{formatSelectedDate(formData.date)}</strong> {copy.timeFrom} <strong>{formData.time}</strong> {copy.timeTo} <strong>{getEndTime(formData.time, formData.packDuration)}</strong> ({formData.packDurationLabel})
                      </p>
                    </div>
                  </div>
                )}

                {error && bookingMode === 'calendar' && (
                  <div id="booking-form-error" className="booking-error-banner" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex justify-between" style={{ marginTop: '2.5rem' }}>
                  <button className="btn btn-secondary" onClick={prevStep}>
                    <ChevronLeft size={16} /> {copy.back}
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={nextStep}
                    disabled={Boolean(slotDisabledReason)}
                    aria-describedby={slotDisabledReason ? 'booking-slot-disabled-help' : undefined}
                  >
                    {copy.continue} <ChevronRight size={16} />
                  </button>
                </div>
                <ActionAvailabilityHint id="booking-slot-disabled-help" message={slotDisabledReason} />
              </Motion.div>
            )}

            {step === 3 && (
              <Motion.div 
                key="step3"
                variants={stepTransition}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <h2 className="booking-step-title">{t('Création de votre Profil', 'Create your profile')}</h2>
                
                <div className="grid md:grid-cols-2 gap-6" style={{ marginBottom: '1.25rem', marginTop: '1rem' }}>
                  <div>
                    <label htmlFor="booking-last-name" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Nom', 'Last name')} *</label>
                    <input id="booking-last-name" name="lastName" autoComplete="family-name" type="text" placeholder={t('Votre nom de famille', 'Your last name')} className="form-input" value={formData.lastName} onChange={e => { setFormData({...formData, lastName: e.target.value}); clearFieldError('lastName'); }} required aria-invalid={Boolean(fieldErrors.lastName)} aria-describedby={fieldErrors.lastName ? 'booking-last-name-error' : undefined} />
                    {fieldErrors.lastName && <p id="booking-last-name-error" className="form-field-error" role="alert">{fieldErrors.lastName}</p>}
                  </div>
                  <div>
                    <label htmlFor="booking-first-name" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Prénom', 'First name')} *</label>
                    <input id="booking-first-name" name="firstName" autoComplete="given-name" type="text" placeholder={t('Votre prénom', 'Your first name')} className="form-input" value={formData.firstName} onChange={e => { setFormData({...formData, firstName: e.target.value}); clearFieldError('firstName'); }} required aria-invalid={Boolean(fieldErrors.firstName)} aria-describedby={fieldErrors.firstName ? 'booking-first-name-error' : undefined} />
                    {fieldErrors.firstName && <p id="booking-first-name-error" className="form-field-error" role="alert">{fieldErrors.firstName}</p>}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="booking-phone" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Téléphone (WhatsApp)', 'Phone (WhatsApp)')} *</label>
                  <input id="booking-phone" name="phone" autoComplete="tel" type="tel" inputMode="tel" placeholder={t('Ex: 640 70 32 49', 'E.g. 640 70 32 49')} className="form-input" value={formData.phone} onChange={e => { setFormData({...formData, phone: e.target.value}); clearFieldError('phone'); }} required aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'booking-phone-error' : undefined} />
                  {fieldErrors.phone && <p id="booking-phone-error" className="form-field-error" role="alert">{fieldErrors.phone}</p>}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="booking-email" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Adresse email', 'Email address')} *</label>
                  <input id="booking-email" name="email" autoComplete="email" type="email" inputMode="email" placeholder={t('Ex: client@exemple.com', 'E.g. client@example.com')} className="form-input" value={formData.email} onChange={e => { setFormData({...formData, email: e.target.value}); clearFieldError('email'); }} required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? 'booking-email-error' : undefined} />
                  {fieldErrors.email && <p id="booking-email-error" className="form-field-error" role="alert">{fieldErrors.email}</p>}
                </div>
                
                <div className="grid md:grid-cols-2 gap-6" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <label htmlFor="booking-birth-date" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Date de naissance (Optionnel)', 'Date of birth (optional)')}</label>
                    <input id="booking-birth-date" name="birthDate" autoComplete="bday" type="date" className="form-input" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                  <div>
                    <label htmlFor="booking-gender" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Genre', 'Gender')} *</label>
                    <select id="booking-gender" name="gender" autoComplete="sex" className="form-input" value={formData.gender} onChange={e => { setFormData({...formData, gender: e.target.value}); clearFieldError('gender'); }} required aria-invalid={Boolean(fieldErrors.gender)} aria-describedby={fieldErrors.gender ? 'booking-gender-error' : undefined}>
                      <option value="">{t('Sélectionner', 'Select')}</option>
                      <option value="Feminin">{t('Féminin', 'Female')}</option>
                      <option value="Masculin">{t('Masculin', 'Male')}</option>
                    </select>
                    {fieldErrors.gender && <p id="booking-gender-error" className="form-field-error" role="alert">{fieldErrors.gender}</p>}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="booking-discovery" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Comment nous avez-vous connus ?', 'How did you hear about us?')}</label>
                  <select id="booking-discovery" name="discoveryChannel" autoComplete="off" className="form-input" value={formData.discoveryChannel} onChange={e => setFormData({...formData, discoveryChannel: e.target.value})}>
                    <option value="">{t('Sélectionner un canal de découverte', 'Select a discovery channel')}</option>
                    <option value="Instagram">Instagram</option>
                    <option value="TikTok">TikTok</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Bouche a oreille">{t('Recommandation / Bouche à oreille', 'Recommendation / word of mouth')}</option>
                    <option value="Recherche web">{t('Recherche Google', 'Google search')}</option>
                  </select>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label htmlFor="booking-notes" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('Notes ou demandes spécifiques (Optionnel)', 'Notes or special requests (optional)')}</label>
                  <textarea id="booking-notes" name="extraInfo" autoComplete="off" placeholder={t("Partagez des détails particuliers (tenues souhaitées, objectifs d'image...)", 'Share any details (outfits, visual objectives, etc.).')} className="form-input" rows="3" value={formData.extraInfo} onChange={e => setFormData({...formData, extraInfo: e.target.value})}></textarea>
                </div>
                
                <React.Suspense fallback={<p>{t('Chargement des choix juridiques…', 'Loading legal choices…')}</p>}>
                  <ReservationConsentFields formData={formData} setFormData={setFormData} fieldErrors={fieldErrors} clearFieldError={clearFieldError} />
                </React.Suspense>

                {error && (
                  <div id="booking-form-error" className="booking-error-banner" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex justify-between" style={{ marginTop: '2.5rem' }}>
                  <button className="btn btn-secondary" onClick={prevStep}>
                    <ChevronLeft size={16} /> {copy.back}
                  </button>
                  <button className="btn btn-primary" onClick={nextStep}>
                    {copy.continue} <ChevronRight size={16} />
                  </button>
                </div>
              </Motion.div>
            )}

            {step === 4 && (
              <Motion.div 
                key="step4"
                variants={stepTransition}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <h2 className="booking-step-title">{copy.paymentTitle}</h2>
                
                {formData.packIsRange && (
                  <div className="pricing-options-box">
                    <h3 style={{ fontSize: '1.05rem', color: '#fff', marginBottom: '1.25rem', fontFamily: 'var(--font-body)', fontWeight: 700 }}>
                      {copy.completeBooking}
                    </h3>
                    
                    <label className={`pricing-option-label ${formData.paymentChoice === 'base' ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="paymentChoice" 
                        value="base" 
                        checked={formData.paymentChoice === 'base'} 
                        onChange={() => setFormData({...formData, paymentChoice: 'base'})} 
                      />
                      <div>
                        <strong>{copy.baseOption}</strong>
                        <p>{copy.baseOptionDetail}</p>
                      </div>
                    </label>

                    <label className={`pricing-option-label ${formData.paymentChoice === 'quote' ? 'active' : ''}`}>
                      <input 
                        type="radio" 
                        name="paymentChoice" 
                        value="quote" 
                        checked={formData.paymentChoice === 'quote'} 
                        onChange={() => setFormData({...formData, paymentChoice: 'quote', transactionId: '', paymentPhone: ''})} 
                      />
                      <div>
                        <strong>{copy.quoteOption}</strong>
                        <p>{copy.quoteOptionDetail}</p>
                      </div>
                    </label>
                  </div>
                )}

                {formData.paymentChoice === 'base' && (
                  <>
                    <div className="payment-invitation">
                      <p>{copy.paymentReference}</p>
                      <div className="payment-ref-code">{reservationIntent?.reference}</div>
                      <div className="payment-amount-wrap">
                        {copy.baseAmount}
                        <strong>{formatFcfa(formData.packPrice)}</strong>
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.01)', padding: '1.5rem', borderRadius: '8px', borderLeft: '3px solid var(--c-gold)' }}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{copy.paymentInstructions}</h4>
                      <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                        {copy.transferBefore}<strong>{formatFcfa(formData.packPrice)}</strong>{copy.transferAfter}
                      </p>
                      <p style={{ fontSize: '0.88rem', color: 'var(--c-gold-light)', margin: 0, fontWeight: 600 }}>
                        ⚠️ {copy.includeReferenceBefore}<span style={{ textDecoration: 'underline' }}>{reservationIntent?.reference}</span>{copy.includeReferenceAfter}
                      </p>
                    </div>
                  </>
                )}

                <div className="booking-info-badge" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)', marginBottom: '2rem' }}>
                  <CalendarIcon size={18} />
                  <span>
                    {copy.sessionOn}<strong>{formatSelectedDate(formData.date)}</strong> {copy.timeFrom} <strong>{formData.time}</strong> {copy.timeTo} <strong>{getEndTime(formData.time, formData.packDuration)}</strong> — <strong>{formData.packName}</strong>
                  </span>
                </div>

                {formData.paymentChoice === 'base' && (
                  <Motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.5rem', marginBottom: '2rem' }}
                  >
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="booking-payment-method" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{copy.mobileOperator}</label>
                      <select id="booking-payment-method" name="paymentMethod" autoComplete="off" className="form-input" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                        <option value="mtn_momo">MTN Mobile Money</option>
                        <option value="orange_money">Orange Money</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="booking-payment-phone" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{copy.paymentPhone}</label>
                      <input id="booking-payment-phone" name="paymentPhone" autoComplete="tel" type="tel" inputMode="tel" placeholder={t('Ex. : 640 70 32 49', 'E.g. 640 70 32 49')} className="form-input" value={formData.paymentPhone} onChange={e => { setFormData({...formData, paymentPhone: e.target.value}); clearFieldError('paymentPhone'); }} required aria-invalid={Boolean(fieldErrors.paymentPhone)} aria-describedby={fieldErrors.paymentPhone ? 'booking-payment-phone-error' : undefined} />
                      {fieldErrors.paymentPhone && <p id="booking-payment-phone-error" className="form-field-error" role="alert">{fieldErrors.paymentPhone}</p>}
                    </div>

                    <div>
                      <label htmlFor="booking-transaction-reference" style={{ display: 'block', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{copy.transactionReference}</label>
                      <input id="booking-transaction-reference" name="transactionId" autoComplete="off" type="text" placeholder={copy.transactionPlaceholder} className="form-input" value={formData.transactionId} onChange={e => { setFormData({...formData, transactionId: e.target.value}); clearFieldError('transactionRef'); }} required aria-invalid={Boolean(fieldErrors.transactionRef)} aria-describedby={fieldErrors.transactionRef ? 'booking-transaction-reference-error' : undefined} />
                      {fieldErrors.transactionRef && <p id="booking-transaction-reference-error" className="form-field-error" role="alert">{fieldErrors.transactionRef}</p>}
                    </div>
                  </Motion.div>
                )}

                {error && (
                  <div id="booking-form-error" className="booking-error-banner" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex justify-between" style={{ marginTop: '2.5rem' }}>
                  <button className="btn btn-secondary" onClick={prevStep} disabled={submittingReservation} aria-describedby={submittingReservation ? 'booking-payment-disabled-help' : undefined}>
                    <ChevronLeft size={16} /> {copy.back}
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={nextStep} 
                    disabled={Boolean(paymentDisabledReason)}
                    aria-describedby={paymentDisabledReason ? 'booking-payment-disabled-help' : undefined}
                  >
                    {submittingReservation ? (
                      <>{copy.processing}</>
                    ) : formData.paymentChoice === 'quote' ? (
                      <>{copy.submitProject} <Send size={14} /></>
                    ) : (
                      <>{copy.confirmSession} <Send size={14} /></>
                    )}
                  </button>
                </div>
                <ActionAvailabilityHint id="booking-payment-disabled-help" message={paymentDisabledReason} />
              </Motion.div>
            )}

            {step === 5 && (
              <Motion.div 
                key="step5"
                variants={stepTransition}
                initial="initial"
                animate="animate"
                className="booking-success-wrap"
              >
                <div className="success-seal-container">
                  <Check size={44} />
                </div>
                
                <h2>
                  {formData.paymentChoice === 'quote' ? copy.quoteReceived : copy.sessionRegistered}
                </h2>
                
                <div className="booking-success-summary">
                  <h4>{copy.bookingSummary}</h4>
                  <div className="summary-row">
                    <span>{copy.session}</span>
                    <strong>{formData.packName}</strong>
                  </div>
                  <div className="summary-row">
                    <span>{copy.dateTime}</span>
                    <strong>{formatSelectedDate(formData.date)} {copy.timeTo} {formData.time}</strong>
                  </div>
                  <div className="summary-row">
                    <span>{copy.duration}</span>
                    <strong>{formData.packDurationLabel}</strong>
                  </div>
                  <div className="summary-row">
                    <span>{copy.reference}</span>
                    <strong style={{ color: 'var(--c-gold-light)', letterSpacing: '1px' }}>
                      {reservationResult?.reference || reservationIntent?.reference}
                    </strong>
                  </div>
                </div>

                <p className="booking-success-note">
                  {formData.paymentChoice === 'quote' ? (
                    <>
                      {copy.quoteSuccessBefore}<strong>WhatsApp</strong>{copy.quoteSuccessAfter}
                    </>
                  ) : (
                    <>
                      {copy.paymentSuccessBefore}{formData.transactionId}{copy.paymentSuccessAfter}
                    </>
                  )}
                </p>

                <div style={{ marginTop: '2rem' }}>
                  <Link to="/" className="btn btn-primary">
                    {copy.home}
                  </Link>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Reservation;
