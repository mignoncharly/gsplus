import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  isValidCameroonPhone,
  isValidEmailAddress,
  normalizeCameroonPhone,
  normalizeEmailAddress,
  validateContactFields,
  validationErrorsFromApi,
} from '../src/lib/contact-validation.js';

const vectors = JSON.parse(
  fs.readFileSync(new URL('../../shared/contact-validation-vectors.json', import.meta.url), 'utf8'),
);

test('VAL-01 frontend matches every shared phone vector', () => {
  for (const vector of vectors.validPhones) {
    assert.equal(isValidCameroonPhone(vector.raw), true, vector.raw);
    assert.equal(normalizeCameroonPhone(vector.raw), vector.normalized, vector.raw);
  }
  for (const value of vectors.invalidPhones) {
    assert.equal(isValidCameroonPhone(value), false, value);
    assert.equal(normalizeCameroonPhone(value), null, value);
  }
});

test('VAL-01 frontend trims email and normalizes only its domain', () => {
  for (const vector of vectors.validEmails) {
    assert.equal(isValidEmailAddress(vector.raw), true, vector.raw);
    assert.equal(normalizeEmailAddress(vector.raw), vector.normalized, vector.raw);
  }
  for (const value of vectors.invalidEmails) {
    assert.equal(isValidEmailAddress(value), false, value);
  }
});

test('VAL-01 returns French errors keyed to phone and email fields', () => {
  assert.deepEqual(
    validateContactFields({
      phone: '640ABC249',
      email: 'adresse invalide',
      phoneRequired: true,
      emailRequired: true,
    }),
    {
      phone: 'Saisissez un numéro camerounais valide, par exemple 640 70 32 49.',
      email: 'Saisissez une adresse e-mail valide.',
    },
  );
  assert.deepEqual(
    validateContactFields({
      phone: '',
      email: 'alice@example.com',
      whatsappConsent: true,
    }),
    { phone: 'Renseignez un téléphone camerounais pour recevoir les informations sur WhatsApp.' },
  );
});


test('VAL-01 maps structured API details back to their visible fields', () => {
  const error = Object.assign(new Error('Validation impossible'), {
    details: [
      { path: 'customer.phone', message: 'Téléphone invalide.' },
      { path: 'customer.email', message: 'E-mail invalide.' },
      { path: 'acceptedTerms', message: 'Conditions requises.' },
    ],
  });
  assert.deepEqual(validationErrorsFromApi(error, {
    'customer.phone': 'phone',
    'customer.email': 'email',
  }), {
    phone: 'Téléphone invalide.',
    email: 'E-mail invalide.',
  });
});
