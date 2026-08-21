import { describe, expect, it } from 'vitest';

import {
  EMAIL_TEMPLATE_CODES,
  EMAIL_TEMPLATE_VERSION,
  emailTemplateRegistry,
  renderEmailTemplate,
} from '../src/emails/templates.js';

const EXPECTED_CODES = [
  'E-01', 'E-02', 'E-03', 'E-04', 'E-04A', 'E-04B', 'E-05', 'E-06', 'E-07',
  'E-08', 'E-09', 'E-10', 'E-11', 'E-12', 'E-13', 'E-14', 'E-15', 'E-16',
  'E-17', 'E-18', 'E-19', 'E-20', 'E-21', 'E-22', 'E-23',
  'I-01', 'I-02', 'I-03', 'I-04', 'I-05', 'I-06', 'I-07', 'I-08', 'I-09',
  'I-10', 'I-11', 'I-12',
] as const;

describe('NOTIF-01 versioned e-mail template registry', () => {
  it('contains every normative external and internal template exactly once', () => {
    expect(EMAIL_TEMPLATE_VERSION).toBe('2026-08-20-phase4');
    expect(EMAIL_TEMPLATE_CODES).toEqual(EXPECTED_CODES);
    expect(Object.keys(emailTemplateRegistry).sort()).toEqual([...EXPECTED_CODES].sort());
  });

  it('declares reconstructable text/HTML templates and required variables', () => {
    for (const code of EXPECTED_CODES) {
      const template = emailTemplateRegistry[code];
      expect(template.code).toBe(code);
      expect(template.version).toBe(EMAIL_TEMPLATE_VERSION);
      expect(template.subject.length).toBeGreaterThan(5);
      expect(template.preheader.length).toBeGreaterThan(5);
      expect(template.body.length).toBeGreaterThan(0);
      expect(template.requiredVariables.length).toBeGreaterThan(0);
    }
  });

  it('rejects a render when a required variable is absent', () => {
    expect(() => renderEmailTemplate('E-01', { reference_courte: 'GSP-260801-TEST' }))
      .toThrowError('EMAIL_TEMPLATE_VARIABLE_MISSING:E-01:prenom_client');
  });

  it('escapes HTML while keeping the exact text render reconstructable', () => {
    const rendered = renderEmailTemplate('E-22', {
      prenom_contact: '<Aline & Co>',
      objet_demande: 'Portrait',
      reference_contact: 'CONTACT-TEST',
      date_reception: '1er août 2026 à 18 h 00',
    });

    expect(rendered.subject).toContain('CONTACT-TEST');
    expect(rendered.text).toContain('Bonjour <Aline & Co>');
    expect(rendered.html).toContain('&lt;Aline &amp; Co&gt;');
    expect(rendered.html).not.toContain('<Aline & Co>');
    expect(rendered.variables).toMatchObject({ prenom_contact: '<Aline & Co>' });
  });

  it('keeps the short reference in every reservation-related client subject', () => {
    const leadCodes = new Set(['E-22', 'E-23']);
    for (const code of EXPECTED_CODES.filter((item) => item.startsWith('E-') && !leadCodes.has(item))) {
      expect(emailTemplateRegistry[code].subject).toContain('[reference_courte]');
    }
  });
  it('suppresses the complete optional organisation phrase in both customer locales', () => {
    const common = { nom_contact: 'Aline', organisation_phrase: '', objet_demande: 'Portrait', reference_b2b: 'B2B-260820-ABCD', date_reception: '20 août 2026' };
    const french = renderEmailTemplate('E-23', common, 'fr');
    const english = renderEmailTemplate('E-23', common, 'en');
    expect(french.text).toContain('demande professionnelle.');
    expect(english.text).toContain('business enquiry.');
    expect(french.text).not.toMatch(/Non renseignée|au nom de/);
    expect(english.text).not.toMatch(/Not provided|on behalf of/);
    expect(renderEmailTemplate('E-23', { ...common, organisation_phrase: ' au nom de Studio Test' }, 'fr').text).toContain('au nom de Studio Test.');
    expect(renderEmailTemplate('E-23', { ...common, organisation_phrase: ' on behalf of Studio Test' }, 'en').text).toContain('on behalf of Studio Test.');
  });

  it('renders English customer acknowledgements when requested', () => {
    const rendered = renderEmailTemplate('E-22', {
      prenom_contact: 'Aline',
      objet_demande: 'Portrait session',
      reference_contact: 'CONTACT-TEST',
      date_reception: '1 August 2026 at 18:00',
    }, 'en');

    expect(rendered.locale).toBe('en');
    expect(rendered.subject).toBe('We received your message — CONTACT-TEST');
    expect(rendered.text).toContain('Hello Aline,');
    expect(rendered.text).not.toContain('Bonjour');
  });
});
