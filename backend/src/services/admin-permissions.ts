import { HttpError } from '../errors/http-error.js';
import { AdminRole, type AdminUser } from '../generated/prisma/client.js';

export type AdminPermission =
  /** Read the payment queue. Deliberately separate from deciding: triage is not a decision. */
  | 'PAYMENT_VIEW'
  | 'PAYMENT_DECIDE'
  | 'PAYMENT_ADD'
  | 'REFUND_MANAGE'
  | 'RESERVATION_CONFIRM'
  | 'RESERVATION_REJECT'
  | 'RESERVATION_CANCEL'
  | 'RESERVATION_RESCHEDULE'
  | 'WITHDRAWAL_MANAGE'
  | 'IMAGE_CONSENT_MANAGE'
  | 'DATA_GOVERNANCE_MANAGE'
  | 'VERIFY_AND_CONFIRM'
  | 'RESERVATION_CLOSE'
  | 'RESERVATION_EARLY_CLOSE_OVERRIDE'
  | 'DELIVERY_PUBLISH'
  | 'MEDIA_RIGHTS_MANAGE'
  | 'PACKAGE_PUBLISH'
  | 'QA_NOTIFICATION_OVERRIDE';

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  [AdminRole.OWNER]: new Set<AdminPermission>([
    'PAYMENT_VIEW',
    'PAYMENT_DECIDE',
    'PAYMENT_ADD',
    'REFUND_MANAGE',
    'RESERVATION_CONFIRM',
    'RESERVATION_REJECT',
    'RESERVATION_CANCEL',
    'RESERVATION_RESCHEDULE',
    'WITHDRAWAL_MANAGE',
    'IMAGE_CONSENT_MANAGE',
    'DATA_GOVERNANCE_MANAGE',
    'VERIFY_AND_CONFIRM',
    'RESERVATION_CLOSE',
    'RESERVATION_EARLY_CLOSE_OVERRIDE',
    'DELIVERY_PUBLISH',
    'MEDIA_RIGHTS_MANAGE',
    'PACKAGE_PUBLISH',
    'QA_NOTIFICATION_OVERRIDE',
  ]),
  // STAFF can read the payment queue to triage it, but every decision, export and
  // refund stays with the OWNER. Widening who may decide on money is a governance
  // change and belongs to the security phase, not here.
  [AdminRole.STAFF]: new Set<AdminPermission>(['RESERVATION_CLOSE', 'PAYMENT_VIEW'])
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
