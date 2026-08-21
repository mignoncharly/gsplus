import { env } from '../config/env.js';

const adminOrigin = () => env.CLIENT_ORIGINS[0] ?? 'https://gsplus.vip';
export const adminReservationUrl = (reference: string) => `${adminOrigin()}/admin/reservations/${encodeURIComponent(reference)}`;
export const adminLeadUrl = (reference: string) => `${adminOrigin()}/admin/leads/${encodeURIComponent(reference)}`;
export const adminFinanceUrl = (taskId: string) => `${adminOrigin()}/admin/finance/${encodeURIComponent(taskId)}`;
