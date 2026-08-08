import { HttpError } from '../errors/http-error.js';
import { AdminRole, type AdminUser } from '../generated/prisma/client.js';

export type AdminPermission =
  | 'PAYMENT_DECIDE'
  | 'PAYMENT_ADD'
  | 'REFUND_MANAGE'
  | 'RESERVATION_CONFIRM'
  | 'RESERVATION_REJECT'
  | 'RESERVATION_CANCEL'
  | 'RESERVATION_RESCHEDULE'
  | 'WITHDRAWAL_MANAGE'
  | 'IMAGE_CONSENT_MANAGE'
  | 'VERIFY_AND_CONFIRM'
  | 'RESERVATION_CLOSE'
  | 'RESERVATION_EARLY_CLOSE_OVERRIDE'
  | 'DELIVERY_PUBLISH'
  | 'PACKAGE_PUBLISH';

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  [AdminRole.OWNER]: new Set<AdminPermission>([
    'PAYMENT_DECIDE',
    'PAYMENT_ADD',
    'REFUND_MANAGE',
    'RESERVATION_CONFIRM',
    'RESERVATION_REJECT',
    'RESERVATION_CANCEL',
    'RESERVATION_RESCHEDULE',
    'WITHDRAWAL_MANAGE',
    'IMAGE_CONSENT_MANAGE',
    'VERIFY_AND_CONFIRM',
    'RESERVATION_CLOSE',
    'RESERVATION_EARLY_CLOSE_OVERRIDE',
    'DELIVERY_PUBLISH',
    'PACKAGE_PUBLISH',
  ]),
  [AdminRole.STAFF]: new Set<AdminPermission>(['RESERVATION_CLOSE'])
};

export const assertAdminPermission = (admin: AdminUser | undefined, permission: AdminPermission) => {
  if (!admin) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentification administrateur requise.');
  }
  if (!ROLE_PERMISSIONS[admin.role].has(permission)) {
    throw new HttpError(
      403,
      'ADMIN_PERMISSION_REQUIRED',
      'Cette décision nécessite le rôle propriétaire.',
      { permission },
    );
  }
};
