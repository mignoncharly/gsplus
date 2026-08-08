import { describe, expect, it } from 'vitest';

import {
  PUBLIC_REFERENCE_ALPHABET,
  PUBLIC_REFERENCE_PATTERN,
  allocatePublicReservationReference,
  generatePublicReservationReference,
} from '../src/utils/reservation-reference.js';

describe('REF-01 public reservation references', () => {
  it('uses the Douala date and a four-character non-ambiguous alphabet', () => {
    const reference = generatePublicReservationReference({
      now: new Date('2026-07-27T23:30:00.000Z'),
      randomBytes: () => Uint8Array.from([0, 1, 2, 3]),
    });

    expect(reference).toBe('GSP-260728-ABCD');
    expect(reference).toMatch(PUBLIC_REFERENCE_PATTERN);
    expect(PUBLIC_REFERENCE_ALPHABET).not.toMatch(/[ILO01]/);
  });

  it('retries collisions without exposing a sequence', async () => {
    const generated = ['GSP-260728-K7M4', 'GSP-260728-K7M4', 'GSP-260728-P9XZ'];
    const existing = new Set(['GSP-260728-K7M4']);
    let attempts = 0;

    const reference = await allocatePublicReservationReference({
      generate: () => {
        attempts += 1;
        return generated.shift()!;
      },
      exists: async (candidate) => existing.has(candidate),
      maxAttempts: 4,
    });

    expect(reference).toBe('GSP-260728-P9XZ');
    expect(attempts).toBe(3);
  });
});
