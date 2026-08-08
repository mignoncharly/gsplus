import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FRENCH_VALIDATION_SUMMARY,
  validationErrorsFromApi,
} from '../src/lib/form-errors.js';

test('P2-01 maps nested API paths to localized field errors', () => {
  const error = {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [
      { path: 'customer.firstName', code: 'too_small', minimum: 1, message: 'Too small' },
      { path: 'transactionRef', code: 'too_small', minimum: 1, message: 'Too small' },
    ],
  };

  assert.deepEqual(validationErrorsFromApi(error, {
    'customer.firstName': 'firstName',
    transactionRef: 'transactionRef',
  }), {
    firstName: 'Renseignez votre prénom.',
    transactionRef: 'Renseignez la référence de transaction.',
  });
  assert.equal(FRENCH_VALIDATION_SUMMARY, 'Corrigez les champs indiqués ci-dessous.');
});

test('P2-01 binds every public business field to an inline error target', () => {
  const root = new URL('../src/pages/', import.meta.url);
  const sources = {
    Contact: readFileSync(new URL('Contact.jsx', root), 'utf8'),
    Corporate: readFileSync(new URL('Corporate.jsx', root), 'utf8'),
    Services: readFileSync(new URL('Services.jsx', root), 'utf8'),
    CreativeServices: readFileSync(new URL('CreativeServices.jsx', root), 'utf8'),
    Reservation: readFileSync(new URL('Reservation.jsx', root), 'utf8'),
  };

  for (const field of ['name', 'message']) assert.match(sources.Contact, new RegExp('fieldErrors\\.' + field));
  for (const field of ['company', 'rccm', 'name', 'message']) assert.match(sources.Corporate, new RegExp('fieldErrors\\.' + field));
  for (const field of ['name', 'service', 'message']) assert.match(sources.Services, new RegExp('fieldErrors\\.' + field));
  for (const field of ['name', 'service', 'message']) assert.match(sources.CreativeServices, new RegExp('fieldErrors\\.' + field));
  for (const field of ['firstName', 'lastName', 'gender', 'acceptedTerms', 'transactionRef']) {
    assert.match(sources.Reservation, new RegExp('fieldErrors\\.' + field));
  }
});
