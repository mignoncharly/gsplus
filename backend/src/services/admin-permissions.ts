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

export const ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  'PAYMENT_VIEW', 'PAYMENT_DECIDE', 'PAYMENT_ADD', 'REFUND_MANAGE',
  'RESERVATION_CONFIRM', 'RESERVATION_REJECT', 'RESERVATION_CANCEL', 'RESERVATION_RESCHEDULE',
  'WITHDRAWAL_MANAGE', 'IMAGE_CONSENT_MANAGE', 'DATA_GOVERNANCE_MANAGE', 'VERIFY_AND_CONFIRM',
  'RESERVATION_CLOSE', 'RESERVATION_EARLY_CLOSE_OVERRIDE', 'DELIVERY_PUBLISH',
  'MEDIA_RIGHTS_MANAGE', 'PACKAGE_PUBLISH', 'QA_NOTIFICATION_OVERRIDE',
] as const;

export const isAdminPermission = (value: string): value is AdminPermission =>
  (ADMIN_PERMISSIONS as readonly string[]).includes(value);

export const rolePermissions = (role: AdminRole): readonly AdminPermission[] => [...ROLE_PERMISSIONS[role]];

/**
 * Extra permissions granted to one account, held in memory.
 *
 * `assertAdminPermission` is synchronous and called from inside request handlers and
 * transactions; making it query the database would make every guarded route asynchronous
 * in a new way and would fail closed at exactly the wrong moment. An empty cache means
 * everyone has precisely what their role carries, which is the state the system is in
 * today and the state it falls back to if a refresh ever fails.
 */
const grants = new Map<string, Set<AdminPermission>>();
let grantsLoadedAt: Date | null = null;
let grantsError: string | null = null;

export const refreshAdminPermissionGrants = async () => {
  try {
    const { prisma } = await import('../db/prisma.js');
    const rows = await prisma.adminPermissionGrant.findMany();
    const next = new Map<string, Set<AdminPermission>>();
    for (const row of rows) {
      if (!isAdminPermission(row.permission)) continue;
      const set = next.get(row.adminUserId) ?? new Set<AdminPermission>();
      set.add(row.permission);
      next.set(row.adminUserId, set);
    }
    grants.clear();
    for (const [key, value] of next) grants.set(key, value);
    grantsLoadedAt = new Date();
    grantsError = null;
  } catch (error) {
    // Keep what is cached; an unreadable grants table must never widen or narrow access.
    grantsError = error instanceof Error ? error.message : 'unknown error';
  }
};

export const adminPermissionGrantStatus = () => ({ accounts: grants.size, loadedAt: grantsLoadedAt, error: grantsError });

export const resetAdminPermissionGrants = () => {
  grants.clear();
  grantsLoadedAt = null;
  grantsError = null;
};

export const hasAdminPermission = (admin: AdminUser, permission: AdminPermission) =>
  ROLE_PERMISSIONS[admin.role].has(permission) || Boolean(grants.get(admin.id)?.has(permission));

/** Everything this account may do, role and grants together, for display. */
export const effectiveAdminPermissions = (admin: { id: string; role: AdminRole }): AdminPermission[] =>
  ADMIN_PERMISSIONS.filter((permission) =>
    ROLE_PERMISSIONS[admin.role].has(permission) || Boolean(grants.get(admin.id)?.has(permission)));

export const assertAdminPermission = (admin: AdminUser | undefined, permission: AdminPermission) => {
  if (!admin) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentification administrateur requise.');
  }
  if (!hasAdminPermission(admin, permission)) {
    throw new HttpError(
      403,
      'ADMIN_PERMISSION_REQUIRED',
      'Vous n’avez pas le droit nécessaire pour cette action.',
      { permission },
    );
  }
};
