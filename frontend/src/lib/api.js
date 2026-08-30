import { getStoredLocale } from './i18n.js';

export { apiFetch, apiUrl, API_URL } from './api-transport.js';
import { apiFetch, apiUrl } from './api-transport.js';

export const getApiHealth = async () => {
  return apiFetch('/api/health');
};

export const getPackages = async () => {
  const payload = await apiFetch('/api/packages');
  return payload.data;
};

export const getCatalogue = async () => {
  const payload = await apiFetch('/api/catalogue');
  return payload.data;
};

export const getAvailability = async ({ from, to, packageId }) => {
  const params = new URLSearchParams({ from, to, packageId });
  const payload = await apiFetch(`/api/availability?${params.toString()}`);
  return payload.data;
};

export const createReservationIntent = async (data) => {
  const payload = await apiFetch('/api/reservation-intents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const getPortfolioMedia = async () => {
  const payload = await apiFetch('/api/media');
  return payload.data;
};

export const mediaUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return apiUrl(url);
  return url;
};

export const createReservation = async (data) => {
  const payload = await apiFetch('/api/reservations', {
    method: 'POST',
    body: JSON.stringify({ ...data, locale: getStoredLocale() }),
  });
  return payload.data;
};

export const loginAdmin = async (data) => {
  const payload = await apiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const logoutAdmin = async () => {
  await apiFetch('/api/admin/logout', {
    method: 'POST',
  });
};

export const getAdminMe = async () => {
  const payload = await apiFetch('/api/admin/me');
  return payload.data;
};

export const changeAdminPassword = async (data) => {
  const payload = await apiFetch('/api/admin/password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const submitContact = async (data) => {
  const payload = await apiFetch('/api/contact', {
    method: 'POST',
    body: JSON.stringify({ ...data, locale: getStoredLocale() }),
  });
  return payload.data;
};

export const submitB2BInquiry = async (data) => {
  const payload = await apiFetch('/api/b2b-inquiries', {
    method: 'POST',
    body: JSON.stringify({ ...data, locale: getStoredLocale() }),
  });
  return payload.data;
};

export const submitQuoteRequest = async (data) => {
  const payload = await apiFetch('/api/quote-requests', {
    method: 'POST',
    body: JSON.stringify({ ...data, locale: getStoredLocale() }),
  });
  return payload.data;
};

export const getAdminPackages = async () => {
  const payload = await apiFetch('/api/admin/packages');
  return payload.data;
};

export const getAdminCatalogueTaxonomy = async () => {
  const payload = await apiFetch('/api/admin/catalogue-taxonomy');
  return payload.data;
};

export const getAdminCatalogueBenefits = async () => {
  const payload = await apiFetch('/api/admin/catalogue-benefits');
  return payload.data;
};
export const createAdminCatalogueBenefit = async (data) =>
  (await apiFetch('/api/admin/catalogue-benefits', { method: 'POST', body: JSON.stringify(data) })).data;
export const updateAdminCatalogueBenefit = async (id, data) =>
  (await apiFetch(`/api/admin/catalogue-benefits/${id}`, { method: 'PATCH', body: JSON.stringify(data) })).data;
export const validateAdminCatalogueBenefit = async (id, expectedVersion) =>
  (await apiFetch(`/api/admin/catalogue-benefits/${id}/validate`, { method: 'POST', body: JSON.stringify({ expectedVersion }) })).data;
export const publishAdminCatalogueBenefit = async (id, expectedVersion) =>
  (await apiFetch(`/api/admin/catalogue-benefits/${id}/publish`, { method: 'POST', body: JSON.stringify({ expectedVersion }) })).data;
export const updateAdminCatalogueTaxonomy = async (key, data) =>
  (await apiFetch(`/api/admin/catalogue-taxonomy/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify(data) })).data;

export const reorderAdminPackages = async (orderedIds) => {
  const payload = await apiFetch('/api/admin/packages/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) });
  return payload.data;
};

export const createAdminPackage = async (data) => {
  const payload = await apiFetch('/api/admin/packages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const duplicateAdminPackage = async (id, data = {}) => {
  const payload = await apiFetch(`/api/admin/packages/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const deleteAdminPackage = async (id) => {
  await apiFetch(`/api/admin/packages/${id}`, {
    method: 'DELETE',
  });
};

export const getAdminLeads = async () => {
  const payload = await apiFetch('/api/admin/leads');
  return payload.data;
};

export const getAdminLead = async (reference) => {
  const payload = await apiFetch(`/api/admin/leads/${encodeURIComponent(reference)}`);
  return payload.data;
};

const adminQuery = (filters = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    // Repeatable filters such as status arrive as arrays.
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, String(entry)));
    else params.set(key, String(value));
  }
  return params.toString();
};

export const getAdminPayments = async (filters = {}) => {
  const payload = await apiFetch(`/api/admin/payments?${adminQuery(filters)}`);
  return { items: payload.data, meta: payload.meta };
};

export const getAdminPayment = async (id) => (await apiFetch(`/api/admin/payments/${encodeURIComponent(id)}`)).data;

export const getAdminPaymentDuplicates = async (id) =>
  (await apiFetch(`/api/admin/payments/${encodeURIComponent(id)}/duplicates`)).data;

export const recordAdminPaymentDeclaredAmount = async (id, body) =>
  (await apiFetch(`/api/admin/payments/${encodeURIComponent(id)}/declared-amount`, { method: 'PATCH', body: JSON.stringify(body) })).data;

export const linkAdminPaymentDuplicate = async (id, body) =>
  (await apiFetch(`/api/admin/payments/${encodeURIComponent(id)}/duplicate`, { method: 'PATCH', body: JSON.stringify(body) })).data;

/** The export is a download, so it bypasses the JSON helper. */
export const adminExportUrl = (kind, filters = {}) =>
  apiUrl(`/api/admin/${kind}/export.csv?${adminQuery(filters)}`);

export const getAdminFinancialTasks = async (filters = {}) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const payload = await apiFetch(`/api/admin/financial-tasks?${params.toString()}`);
  return { items: payload.data, meta: payload.meta };
};

export const getAdminFinancialTask = async (id) => {
  const payload = await apiFetch(`/api/admin/financial-tasks/${encodeURIComponent(id)}`);
  return payload.data;
};

// === Phase 5 scheduling ===
// === Phase 6 settings and content ===
export const getAdminSettings = async () => (await apiFetch('/api/admin/settings')).data;
export const saveAdminSettingGroup = async (group, values) =>
  (await apiFetch(`/api/admin/settings/${encodeURIComponent(group)}`, { method: 'PUT', body: JSON.stringify({ values }) })).data;
export const getAdminContent = async (locale = 'fr') => (await apiFetch(`/api/admin/content?locale=${locale}`)).data;
export const saveAdminContentDraft = async (key, locale, body) =>
  (await apiFetch(`/api/admin/content/${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ locale, body }) })).data;
export const publishAdminContent = async (key, locale = 'fr') =>
  (await apiFetch(`/api/admin/content/${encodeURIComponent(key)}/publish?locale=${locale}`, { method: 'POST' })).data;

export const getAdminBusinessHours = async () => (await apiFetch('/api/admin/schedule/business-hours')).data;
export const saveAdminBusinessHour = async (dayOfWeek, body) =>
  (await apiFetch(`/api/admin/schedule/business-hours/${dayOfWeek}`, { method: 'PUT', body: JSON.stringify(body) })).data;
export const getAdminScheduleExceptions = async (params = {}) =>
  (await apiFetch(`/api/admin/schedule/exceptions?${adminQuery(params)}`)).data;
export const saveAdminScheduleException = async (body) =>
  (await apiFetch('/api/admin/schedule/exceptions', { method: 'PUT', body: JSON.stringify(body) })).data;
export const deleteAdminScheduleException = async (date) =>
  apiFetch(`/api/admin/schedule/exceptions/${encodeURIComponent(date)}`, { method: 'DELETE' });
export const getAdminBookingRules = async () => (await apiFetch('/api/admin/schedule/booking-rules')).data;
export const saveAdminBookingRule = async (body) =>
  (await apiFetch('/api/admin/schedule/booking-rules', { method: 'PUT', body: JSON.stringify(body) })).data;
export const getAdminPlanning = async (from, to) =>
  (await apiFetch(`/api/admin/schedule/planning?${adminQuery({ from, to })}`)).data;
export const getAdminCalendarHealth = async () => (await apiFetch('/api/admin/calendar/health')).data;

export const getAdminDashboard = async () => (await apiFetch('/api/admin/dashboard')).data;

/** Returns rows only, for the callers that just want the list. */
export const getAdminReservations = async (filters = {}) => (await searchAdminReservations(filters)).items;

/** Returns rows and `meta`, so a caller can page and show a real total. */
export const searchAdminReservations = async (filters = {}) => {
  const payload = await apiFetch(`/api/admin/reservations?${adminQuery(filters)}`);
  return { items: payload.data, meta: payload.meta ?? { total: payload.data.length, limit: 25, offset: 0 } };
};

export const getAdminReservation = async (id) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}`);
  return payload.data;
};

export const previewAdminCustomerDecision = async (data) => {
  const payload = await apiFetch('/api/admin/communication-preview', { method: 'POST', body: JSON.stringify(data) });
  return payload.data;
};

export const updateAdminReservation = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const cancelAdminReservation = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const updateAdminLead = async (id, data) => {
  const payload = await apiFetch(`/api/admin/leads/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const updateAdminPackage = async (id, data) => {
  const payload = await apiFetch(`/api/admin/packages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const validateAdminPackage = async (id, data) => {
  const payload = await apiFetch(`/api/admin/packages/${id}/validate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const publishAdminPackage = async (id, data) => {
  const payload = await apiFetch(`/api/admin/packages/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const archiveAdminPackage = async (id, data) => {
  const payload = await apiFetch(`/api/admin/packages/${id}/archive`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const verifyAdminPayment = async (id, data) => {
  const payload = await apiFetch(`/api/admin/payments/${id}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const refundAdminPayment = async (id, data) => {
  const payload = await apiFetch(`/api/admin/payments/${id}/refund`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const addAdminReservationPayment = async (reservationId, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${reservationId}/payments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const publishAdminReservationDelivery = async (reservationId, data) => {
  const payload = await apiFetch('/api/admin/reservations/' + reservationId + '/deliveries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const verifyAndConfirmAdminReservation = async (reservationId, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${reservationId}/verify-and-confirm`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const rescheduleAdminReservation = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}/reschedule-requests`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const decideAdminRescheduleRequest = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reschedule-requests/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const createAdminWithdrawalRequest = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}/withdrawal-requests`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const decideAdminWithdrawalRequest = async (id, data) => {
  const payload = await apiFetch(`/api/admin/withdrawal-requests/${id}/decision`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const createAdminImageConsentEvent = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}/image-consent-events`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const syncAdminReservationCalendar = async (reservationId) => {
  const payload = await apiFetch(`/api/admin/calendar/sync/${reservationId}`, {
    method: 'POST',
  });
  return payload.data;
};

export const getAdminMedia = async () => {
  const payload = await apiFetch('/api/admin/media');
  return payload.data;
};

export const getAdminNotifications = async (filters = {}) => {
  const payload = await apiFetch(`/api/admin/notifications?${adminQuery(filters)}`);
  return payload.data;
};

export const searchAdminNotifications = async (filters = {}) => {
  const payload = await apiFetch(`/api/admin/notifications?${adminQuery(filters)}`);
  return { items: payload.data, meta: payload.meta ?? { total: payload.data.length, limit: 50, offset: 0, hiddenChannels: [] } };
};

// === Phase 7 message library ===
export const getAdminMessages = async (locale = 'fr') => {
  const payload = await apiFetch(`/api/admin/messages?locale=${locale}`);
  return { items: payload.data, meta: payload.meta };
};
export const saveAdminMessageDraft = async (code, body) =>
  (await apiFetch(`/api/admin/messages/${encodeURIComponent(code)}`, { method: 'POST', body: JSON.stringify(body) })).data;
export const publishAdminMessage = async (code, locale = 'fr') =>
  (await apiFetch(`/api/admin/messages/${encodeURIComponent(code)}/publish?locale=${locale}`, { method: 'POST' })).data;
export const revertAdminMessage = async (code, locale = 'fr') =>
  apiFetch(`/api/admin/messages/${encodeURIComponent(code)}/revert?locale=${locale}`, { method: 'POST' });
export const previewAdminMessage = async (code, body) =>
  (await apiFetch(`/api/admin/messages/${encodeURIComponent(code)}/preview`, { method: 'POST', body: JSON.stringify(body) })).data;
export const testSendAdminMessage = async (code, locale = 'fr') =>
  (await apiFetch(`/api/admin/messages/${encodeURIComponent(code)}/test-send?locale=${locale}`, { method: 'POST' })).data;
export const getAdminMessageRules = async () => {
  const payload = await apiFetch('/api/admin/message-rules');
  return { items: payload.data, meta: payload.meta };
};
export const saveAdminMessageRule = async (body) =>
  (await apiFetch('/api/admin/message-rules', { method: 'PUT', body: JSON.stringify(body) })).data;

export const resolveAdminNotification = async (id, data) => {
  const payload = await apiFetch(`/api/admin/notifications/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const retryAdminNotification = async (id) => {
  const payload = await apiFetch(`/api/admin/notifications/${id}/retry`, {
    method: 'POST',
  });
  return payload.data;
};

export const createAdminMedia = async (data) => {
  if (data instanceof FormData) {
    const payload = await apiFetch('/api/admin/media', {
      method: 'POST',
      body: data,
    });
    return payload.data;
  }

  const payload = await apiFetch('/api/admin/media', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const updateAdminMedia = async (id, data) => {
  const payload = await apiFetch(`/api/admin/media/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const deleteAdminMedia = async (id) => {
  await apiFetch(`/api/admin/media/${id}`, {
    method: 'DELETE',
  });
};

export const getAdminAvailabilityBlocks = async () => {
  const payload = await apiFetch('/api/admin/availability-blocks');
  return payload.data;
};

export const createAdminAvailabilityBlock = async (data) => {
  const payload = await apiFetch('/api/admin/availability-blocks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const updateAdminAvailabilityBlock = async (id, data) => {
  const payload = await apiFetch(`/api/admin/availability-blocks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const deleteAdminAvailabilityBlock = async (id) => {
  await apiFetch(`/api/admin/availability-blocks/${id}`, {
    method: 'DELETE',
  });
};


export const getAdminDataGovernance = async () => {
  const payload = await apiFetch('/api/admin/data-governance');
  return payload.data;
};

export const createAdminDataRightsRequest = async (data) => {
  const payload = await apiFetch('/api/admin/data-rights-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const updateAdminDataRightsRequest = async (id, data) => {
  const payload = await apiFetch(`/api/admin/data-rights-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};
