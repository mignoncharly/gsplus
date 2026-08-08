export const ADMIN_REFRESH_INTERVAL_MS = 60_000;

export const shouldRunAdminRefresh = ({ isAuthenticated, visibilityState }) =>
  Boolean(isAuthenticated && visibilityState === 'visible');
