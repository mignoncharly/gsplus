import { describe, expect, it } from 'vitest';

import {
  OWNER_LEGAL_EFFECTIVE_AT,
  OWNER_LEGAL_SOURCES,
  OWNER_LEGAL_VERSION,
  loadOwnerLegalDocuments,
} from '../src/legal/owner-legal-documents.js';

describe('documents juridiques OWNER du 11 août 2026', () => {
  it('charge les trois sources exactes et vérifie chaque SHA-256', async () => {
    const documents = await loadOwnerLegalDocuments();
    expect(documents).toHaveLength(3);
    expect(documents.map((document) => document.documentType)).toEqual(['TERMS', 'PRIVACY', 'LEGAL_NOTICE']);
    expect(documents.map((document) => document.sourceDocumentHash)).toEqual(
      OWNER_LEGAL_SOURCES.map((source) => source.expectedSha256),
    );
    expect(documents.every((document) => document.version === OWNER_LEGAL_VERSION)).toBe(true);
    expect(documents.every((document) => document.effectiveAt === OWNER_LEGAL_EFFECTIVE_AT)).toBe(true);
    expect(documents.every((document) => document.noticeText.length > 0)).toBe(true);
  });
});
