import { describe, expect, it } from 'vitest';

import { localizeValidationIssue } from '../src/utils/validation-localization.js';

describe('P2-01 validation localization', () => {
  it('translates required, length and nested-field issues into precise French', () => {
    expect(localizeValidationIssue({
      code: 'too_small', path: ['name'], message: 'Too small: expected string to have >=1 characters', minimum: 1,
    })).toBe('Renseignez votre nom.');
    expect(localizeValidationIssue({
      code: 'too_small', path: ['message'], message: 'Too small: expected string to have >=10 characters', minimum: 10,
    })).toBe('Le message doit contenir au moins 10 caractères.');
    expect(localizeValidationIssue({
      code: 'invalid_type', path: ['customer', 'firstName'], message: 'Invalid input: expected string, received undefined',
    })).toBe('Renseignez votre prénom.');
    expect(localizeValidationIssue({
      code: 'invalid_value', path: ['acceptedTerms'], message: 'Invalid input: expected true',
    })).toBe('Vous devez accepter les conditions générales.');
  });

  it('keeps approved French business messages and localizes English custom fallbacks', () => {
    expect(localizeValidationIssue({
      code: 'custom', path: ['phone'], message: 'Saisissez un numéro camerounais valide.',
    })).toBe('Saisissez un numéro camerounais valide.');
    expect(localizeValidationIssue({
      code: 'custom', path: ['endAt'], message: 'endAt must be after startAt',
    })).toBe("L’heure de fin doit être postérieure à l’heure de début.");
  });
});
