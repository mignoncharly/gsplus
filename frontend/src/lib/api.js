import { getStoredLocale } from './i18n.js';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const apiFetch = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'Accept-Language': getStoredLocale(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.error?.message || `API request failed with ${response.status}`;
    const error = new Error(message);
    error.code = payload?.error?.code;
    error.details = payload?.error?.details || [];
    error.status = response.status;
    throw error;
  }

  return payload;
};

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
  if (url.startsWith('/uploads')) return `${API_URL}${url}`;
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
  `${API_URL}/api/admin/${kind}/export.csv?${adminQuery(filters)}`;

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

export const getAdminNotifications = async () => {
  const payload = await apiFetch('/api/admin/notifications');
  return payload.data;
};

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

export { API_URL };

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
