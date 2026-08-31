import { createHash } from 'node:crypto';

import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { businessDateKey } from '../utils/business-time.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_API_VERSION = '2024-06-11';

const schedulePayload = async () => {
  const [hours, exceptions] = await Promise.all([
    prisma.businessHour.findMany({ orderBy: { dayOfWeek: 'asc' } }),
    prisma.scheduleException.findMany({ where: { date: { gte: businessDateKey(new Date()) } }, orderBy: { date: 'asc' } }),
  ]);
  const availability = hours.flatMap((hour) => {
    if (hour.isClosed) return [];
    const pauses: Array<{ start: string; end: string }> = Array.isArray(hour.breaks)
      ? hour.breaks.flatMap((item) => {
        const value = item as Record<string, unknown>;
        return typeof value.start === 'string' && typeof value.end === 'string' ? [{ start: value.start, end: value.end }] : [];
      })
      : [];
    const entries: Array<{ days: string[]; startTime: string; endTime: string }> = [];
    let startTime = hour.opensAt;
    for (const pause of pauses) {
      if (startTime < pause.start) entries.push({ days: [DAY_NAMES[hour.dayOfWeek]], startTime, endTime: pause.start });
      startTime = pause.end;
    }
    if (startTime < hour.closesAt) entries.push({ days: [DAY_NAMES[hour.dayOfWeek]], startTime, endTime: hour.closesAt });
    return entries;
  });
  // Cal.com's documented schedule overrides encode special opening intervals. A full
  // closure is still enforced by Golden Studio Plus' public availability service.
  const overrides = exceptions.filter((item) => !item.isClosed && item.opensAt && item.closesAt).map((item) => ({
    date: item.date, startTime: item.opensAt!, endTime: item.closesAt!,
  }));
  return { name: 'Golden Studio Plus', timeZone: env.CALCOM_TIME_ZONE, availability, overrides };
};

export const syncStudioScheduleToCalendar = async (mutationKey: string) => {
  const payload = await schedulePayload();
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const idempotencyKey = `studio-schedule:${mutationKey}`;
  const configured = Boolean(env.CALCOM_API_KEY && env.CALCOM_SCHEDULE_ID);
  const log = await prisma.calendarSyncLog.create({
    data: {
      provider: 'cal_com', action: 'SCHEDULE_UPDATE', idempotencyKey, payloadHash,
      status: configured ? 'SYNCING' : 'NOT_REQUIRED', attemptCount: configured ? 1 : 0,
      lastAttemptAt: configured ? new Date() : null,
      providerStatus: configured ? 'sending' : 'not_configured',
      error: configured ? null : 'CALENDAR_SCHEDULE_NOT_CONFIGURED',
    },
  }).catch(async (error: unknown) => {
    if (error instanceof Error && /Unique constraint/.test(error.message)) {
      return prisma.calendarSyncLog.findUniqueOrThrow({ where: { idempotencyKey } });
    }
    throw error;
  });
  if (!configured) return log;
  try {
    const response = await fetch(`${env.CALCOM_API_BASE_URL.replace(/\/$/, '')}/schedules/${encodeURIComponent(env.CALCOM_SCHEDULE_ID!)}`, {
      method: 'PATCH', signal: AbortSignal.timeout(env.CALCOM_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${env.CALCOM_API_KEY}`, 'Content-Type': 'application/json', 'cal-api-version': SCHEDULE_API_VERSION },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`CALCOM_HTTP_${response.status}`);
    return prisma.calendarSyncLog.update({ where: { id: log.id }, data: { status: 'SYNCED', providerStatus: 'success', syncedAt: new Date(), error: null } });
  } catch (error) {
    return prisma.calendarSyncLog.update({ where: { id: log.id }, data: { status: 'FAILED', providerStatus: 'failed', error: error instanceof Error ? error.message : 'CALENDAR_SYNC_FAILED' } });
  }
};
