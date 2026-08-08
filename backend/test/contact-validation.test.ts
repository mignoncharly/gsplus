import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  isValidCameroonPhone,
  isValidEmailAddress,
  normalizeCameroonPhone,
  normalizeEmailAddress,
} from '../src/utils/contact-validation.js';
import { contactSchema, reservationCreateSchema } from '../src/validation/schemas.js';

const vectors = JSON.parse(
  fs.readFileSync(new URL('../../shared/contact-validation-vectors.json', import.meta.url), 'utf8'),
) as {
  validPhones: Array<{ raw: string; normalized: string }>;
  invalidPhones: string[];
  validEmails: Array<{ raw: string; normalized: string }>;
  invalidEmails: string[];
};

describe('VAL-01 contact validation', () => {
  it('normalizes only the approved Cameroon phone formats', () => {
    for (const vector of vectors.validPhones) {
      expect(isValidCameroonPhone(vector.raw), vector.raw).toBe(true);
      expect(normalizeCameroonPhone(vector.raw), vector.raw).toBe(vector.normalized);
    }
    for (const value of vectors.invalidPhones) {
      expect(isValidCameroonPhone(value), value).toBe(false);
      expect(normalizeCameroonPhone(value), value).toBeNull();
    }
  });

  it('trims email and normalizes only its domain', () => {
    for (const vector of vectors.validEmails) {
      expect(isValidEmailAddress(vector.raw), vector.raw).toBe(true);
      expect(normalizeEmailAddress(vector.raw), vector.raw).toBe(vector.normalized);
    }
    for (const value of vectors.invalidEmails) {
      expect(isValidEmailAddress(value), value).toBe(false);
    }
  });

  it('returns French field paths and keeps reservation phone raw beside E.164', () => {
    const parsed = reservationCreateSchema.safeParse({
      intentId: 'intent-val-01',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      customer: {
        firstName: 'Alice',
        lastName: 'Validation',
        phone: '640 70 32 49',
        email: ' Alice@EXAMPLE.COM ',
      },
      consentImage: false,
      whatsappConsent: false,
      acceptedTerms: true,
      paymentChoice: 'quote',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.customer).toMatchObject({
        phoneRaw: '640 70 32 49',
        phone: '+237640703249',
        email: 'Alice@example.com',
      });
    }

    const invalid = contactSchema.safeParse({
      submissionKey: '00000000-0000-4000-8000-000000000002',
      name: 'Alice',
      email: 'adresse invalide',
      phone: '640ABC249',
      whatsappConsent: true,
      message: 'Message de validation complet.',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ['email'], message: expect.stringMatching(/e-mail valide/i) }),
        expect.objectContaining({ path: ['phone'], message: expect.stringMatching(/camerounais valide/i) }),
      ]));
    }
  });

  it('requires a phone when WhatsApp consent is selected', () => {
    const result = contactSchema.safeParse({
      submissionKey: '00000000-0000-4000-8000-000000000003',
      name: 'Alice',
      email: 'alice@example.com',
      whatsappConsent: true,
      message: 'Message de validation complet.',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ['phone'],
        message: expect.stringMatching(/WhatsApp/i),
      }));
    }
  });
});
