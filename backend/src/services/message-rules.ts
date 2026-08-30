import { prisma } from '../db/prisma.js';

/**
 * Sending rules for the studio's internal notifications, held in memory.
 *
 * Same reasoning as the template overrides: the outbox has to keep working when the
 * database is briefly unavailable, so a rule lookup is a Map read that cannot throw. An
 * empty cache means every event behaves exactly as the code that enqueued it intended,
 * which is the state the system is in until an owner sets a rule.
 */
export type MessageRuleSettings = {
  delayMinutes: number | null;
  groupingWindowMinutes: number | null;
  maxAttempts: number | null;
  isEnabled: boolean;
};

/**
 * The internal e-mails an owner may govern. Anything not listed here — every customer
 * message — is out of reach of these rules by construction.
 */
export const GOVERNED_EVENTS = [
  'booking_received_admin',
  'lead_created_admin',
  'payment_added_admin',
  'refund_action_required_admin',
  'cancellation_financial_action_required_admin',
  'reschedule_request_review_admin',
  'reservation_decision_overdue_admin',
  'daily_operations_digest_admin',
  'calendar_sync_failed_admin',
  'whatsapp_delivery_failed_admin',
  'email_permanent_bounce_admin',
  'data_integrity_incident_admin',
] as const;

/**
 * Alarms. Delay and grouping still apply, but these cannot be switched off: an owner who
 * silenced an integration failure or a data integrity incident would lose the only
 * signal that something is wrong.
 */
export const UNSILENCEABLE_EVENTS = new Set<string>([
  'calendar_sync_failed_admin',
  'whatsapp_delivery_failed_admin',
  'email_permanent_bounce_admin',
  'data_integrity_incident_admin',
]);

export const isGovernedEvent = (event: string): boolean =>
  (GOVERNED_EVENTS as readonly string[]).includes(event);

const rules = new Map<string, MessageRuleSettings>();
let lastLoadedAt: Date | null = null;
let lastError: string | null = null;

export const refreshMessageRules = async () => {
  try {
    const rows = await prisma.messageRule.findMany();
    const next = new Map<string, MessageRuleSettings>();
    for (const row of rows) {
      if (!isGovernedEvent(row.event)) continue;
      next.set(row.event, {
        delayMinutes: row.delayMinutes,
        groupingWindowMinutes: row.groupingWindowMinutes,
        maxAttempts: row.maxAttempts,
        // A rule can never silence an alarm, whatever the stored row says.
        isEnabled: row.isEnabled || UNSILENCEABLE_EVENTS.has(row.event),
      });
    }
    rules.clear();
    for (const [key, value] of next) rules.set(key, value);
    lastLoadedAt = new Date();
    lastError = null;
  } catch (error) {
    // Keep whatever is cached; an unreadable rule table must not stop the outbox.
    lastError = error instanceof Error ? error.message : 'unknown error';
  }
};

export const getMessageRule = (event: string): MessageRuleSettings | null => rules.get(event) ?? null;

export const messageRuleStatus = () => ({ count: rules.size, lastLoadedAt, lastError });

export const resetMessageRules = () => {
  rules.clear();
  lastLoadedAt = null;
  lastError = null;
};
