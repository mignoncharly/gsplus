import { describe, expect, it } from 'vitest';

import { mediaAlerts, mediaIntegrity, mediaIntegritySummary } from '../../src/services/media-integrity.js';
import { MEDIA_RIGHTS_BASES } from '../../src/services/media-rights.js';

const healthy = {
  id: 'm1', title: 'Portrait', url: '/uploads/a.jpg', width: 1600, height: 1200, fileSize: 240_000,
  thumbnailUrl: '/uploads/a-thumb.jpg', thumbnailFileSize: 12_000, mimeType: 'image/jpeg',
  altText: 'Portrait en studio', rightsBasis: MEDIA_RIGHTS_BASES.catalog, reservationId: null,
  isPublished: true, consentUsages: [],
};

const codes = (item: Parameters<typeof mediaAlerts>[0]) => mediaAlerts(item).map((alert) => alert.code);

describe('§10 media integrity', () => {
  it('says nothing about a complete media', () => {
    expect(mediaAlerts(healthy)).toEqual([]);
    expect(mediaIntegrity(healthy).publishable).toBe(true);
  });

  it('raises the failures that look like healthy records in a list', () => {
    expect(codes({ ...healthy, fileSize: 0 })).toContain('EMPTY_FILE');
    expect(codes({ ...healthy, width: null })).toContain('DIMENSIONS_UNKNOWN');
    expect(codes({ ...healthy, thumbnailUrl: null })).toContain('THUMBNAIL_MISSING');
    expect(codes({ ...healthy, thumbnailFileSize: 0 })).toContain('EMPTY_THUMBNAIL');
    expect(codes({ ...healthy, altText: '   ' })).toContain('ALT_TEXT_MISSING');
    expect(codes({ ...healthy, fileSize: null })).toContain('FILE_SIZE_UNKNOWN');
  });

  it('treats an unestablished right as blocking, and an unset one too', () => {
    expect(mediaIntegrity({ ...healthy, rightsBasis: null }).publishable).toBe(false);
    // An unrecognised value is not a right the studio can rely on either.
    expect(mediaIntegrity({ ...healthy, rightsBasis: 'PROBABLY_FINE' }).publishable).toBe(false);
  });

  it('blocks a customer image whose authorisation is no longer active', () => {
    const customer = { ...healthy, rightsBasis: MEDIA_RIGHTS_BASES.customer, reservationId: 'r1' };
    expect(mediaIntegrity({ ...customer, consentUsages: [{ status: 'ACTIVE' }] }).publishable).toBe(true);
    expect(codes({ ...customer, consentUsages: [{ status: 'WITHDRAWN' }] })).toContain('CONSENT_INACTIVE');
    expect(codes({ ...customer, consentUsages: [] })).toContain('CONSENT_INACTIVE');
  });

  it('separates a media that is merely imperfect from one that is live and must not be', () => {
    // A warning does not stop publication; the report asks for actionable, not alarmist.
    const imperfect = mediaIntegrity({ ...healthy, altText: null });
    expect(imperfect.publishable).toBe(true);
    expect(imperfect.isLiveWithBlockingAlert).toBe(false);

    const live = mediaIntegrity({ ...healthy, isPublished: true, fileSize: 0 });
    expect(live.isLiveWithBlockingAlert).toBe(true);
    const draft = mediaIntegrity({ ...healthy, isPublished: false, fileSize: 0 });
    expect(draft.isLiveWithBlockingAlert).toBe(false);
  });

  it('summarises by consequence, blocking first', () => {
    const summary = mediaIntegritySummary([
      healthy,
      { ...healthy, id: 'm2', altText: null },
      { ...healthy, id: 'm3', altText: null },
      { ...healthy, id: 'm4', rightsBasis: null, isPublished: true },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.liveWithBlocking).toBe(1);
    expect(summary.alerts[0]).toMatchObject({ code: 'RIGHTS_UNVERIFIED', severity: 'blocking', count: 1 });
    expect(summary.alerts.find((alert) => alert.code === 'ALT_TEXT_MISSING')).toMatchObject({ count: 2 });
  });
});
