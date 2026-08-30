import { describe, expect, it } from 'vitest';

import { DATA_RIGHTS_RESPONSE_TEMPLATES, dataRightsCsv, renderResponseTemplate, responseWindow } from '../../src/services/data-rights-queue.js';

const now = new Date('2026-08-30T12:00:00Z');
const days = (count: number) => new Date(now.getTime() + count * 86_400_000);

describe('ADM-10 the register as a work queue', () => {
  it('computes lateness from the clock rather than a stored flag', () => {
    expect(responseWindow({ targetResponseAt: days(-1), closedAt: null }, now)).toMatchObject({ isOverdue: true, isDueSoon: false });
    expect(responseWindow({ targetResponseAt: days(2), closedAt: null }, now)).toMatchObject({ isOverdue: false, isDueSoon: true });
    expect(responseWindow({ targetResponseAt: days(20), closedAt: null }, now)).toMatchObject({ isOverdue: false, isDueSoon: false });
  });

  it('never calls an answered request late, but remembers that the answer was late', () => {
    // It was answered; the deadline no longer demands action.
    const closedLate = responseWindow({ targetResponseAt: days(-5), closedAt: days(-1) }, now);
    expect(closedLate.isOverdue).toBe(false);
    expect(closedLate.closed).toBe(true);
    // The fact still has to survive, or a register of late answers shows none.
    expect(closedLate.answeredLate).toBe(true);

    const closedOnTime = responseWindow({ targetResponseAt: days(-1), closedAt: days(-3) }, now);
    expect(closedOnTime.answeredLate).toBe(false);
  });

  it('fills a response template from the request, and leaves an unknown hole visible', () => {
    const request = { reference: 'DR-2026-0007', requesterName: 'Awa Ndiaye', receivedAt: new Date('2026-08-01T10:00:00Z') };
    const identity = renderResponseTemplate('IDENTITY_REQUEST', request);
    expect(identity?.text).toContain('Awa Ndiaye');
    expect(identity?.text).toContain('DR-2026-0007');
    expect(identity?.text).toContain('2026-08-01');

    // A refusal without a reason must not silently read as a complete letter.
    const refusal = renderResponseTemplate('REFUSAL', request);
    expect(refusal?.text).toContain('[motif]');
    expect(renderResponseTemplate('REFUSAL', request, 'demande manifestement infondée')?.text)
      .toContain('demande manifestement infondée');

    expect(renderResponseTemplate('NOT_A_TEMPLATE', request)).toBeNull();
  });

  it('offers a template for each step the register actually has', () => {
    expect(DATA_RIGHTS_RESPONSE_TEMPLATES.map((item) => item.code))
      .toEqual(['IDENTITY_REQUEST', 'ACCESS_GRANTED', 'ERASURE_DONE', 'REFUSAL']);
  });

  it('exports the evidence fields, quoting a summary that contains a comma', () => {
    const csv = dataRightsCsv([{
      reference: 'DR-2026-0007', requestType: 'ACCESS', status: 'RECEIVED', requesterName: 'Awa Ndiaye',
      requesterEmail: 'awa@example.test', requesterPhone: null, reservationReference: null, requestChannel: 'EMAIL',
      identityStatus: 'VERIFIED', identityEvidenceReference: 'ID-2026-11', requestSummary: 'Accès',
      receivedAt: new Date('2026-08-01T10:00:00Z'), targetResponseAt: days(5), closedAt: null,
      responseEvidence: 'MAIL-2026-33', responseSummary: 'Données transmises, avec la copie du dossier.',
      window: responseWindow({ targetResponseAt: days(5), closedAt: null }, now),
    } as never]);
    const [header, row] = csv.split('\r\n');
    expect(header).toContain('preuve_identite');
    expect(header).toContain('en_retard');
    expect(row).toContain('ID-2026-11');
    expect(row).toContain('"Données transmises, avec la copie du dossier."');
    expect(row).toContain('non');
  });
});
