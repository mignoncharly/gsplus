const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const apiFetch = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    throw new Error(message);
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
    body: JSON.stringify(data),
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

export const submitContact = async (data) => {
  const payload = await apiFetch('/api/contact', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const submitB2BInquiry = async (data) => {
  const payload = await apiFetch('/api/b2b-inquiries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const submitQuoteRequest = async (data) => {
  const payload = await apiFetch('/api/quote-requests', {
    method: 'POST',
    body: JSON.stringify(data),
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

export const getAdminReservations = async () => {
  const payload = await apiFetch('/api/admin/reservations');
  return payload.data;
};

export const getAdminReservation = async (id) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}`);
  return payload.data;
};

export const updateAdminReservation = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}`, {
    method: 'PATCH',
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

export const verifyAdminPayment = async (id, data) => {
  const payload = await apiFetch(`/api/admin/payments/${id}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return payload.data;
};

export const rescheduleAdminReservation = async (id, data) => {
  const payload = await apiFetch(`/api/admin/reservations/${id}/reschedule`, {
    method: 'PATCH',
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
