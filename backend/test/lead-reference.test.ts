import { describe, expect, it } from 'vitest';
import { LeadType } from '../src/generated/prisma/enums.js';
import { allocateLeadReference, generateLeadReference, LEAD_REFERENCE_PATTERN } from '../src/utils/lead-reference.js';

describe('Phase 4 durable lead references', () => {
  it('creates readable type/date references from unbiased symbols', () => {
    const reference = generateLeadReference(LeadType.QUOTE, new Date('2026-08-20T12:00:00Z'), () => Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]));
    expect(reference).toBe('DEVIS-260820-ABCD');
    expect(reference).toMatch(LEAD_REFERENCE_PATTERN);
  });
  it('retries collisions and returns one unique reference', async () => {
    const candidates = ['CONTACT-260820-ABCD', 'CONTACT-260820-EFGH'];
    const value = await allocateLeadReference(LeadType.CONTACT, async (candidate) => candidate.endsWith('ABCD'), () => candidates.shift()!);
    expect(value).toBe('CONTACT-260820-EFGH');
  });
});
