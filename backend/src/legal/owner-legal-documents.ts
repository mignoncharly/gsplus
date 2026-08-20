import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const OWNER_LEGAL_VERSION = '2026-08-11';
export const OWNER_LEGAL_EFFECTIVE_AT = new Date('2026-08-11T00:00:00.000Z');
export const OWNER_LEGAL_PUBLISHED_AT = new Date('2026-08-11T00:00:00.000Z');

export const OWNER_LEGAL_SOURCES = Object.freeze([
  {
    id: 'legal-terms-2026-08-11',
    documentType: 'TERMS',
    file: 'cgv.txt',
    expectedSha256: '1bb97bc010c71237a4494cf842e4cfe3146c7c249fd715593e02d20eeb868e7d',
    purpose: 'CONTRACT',
    scope: ['RESERVATION', 'PAYMENT', 'SERVICE'],
    route: '/cgv',
  },
  {
    id: 'legal-privacy-2026-08-11',
    documentType: 'PRIVACY',
    file: 'politique de confidentialite.txt',
    expectedSha256: 'dff41d3a34d86d4298f13daab306009fd585e3cffb9c33c7cf22a36d5ed4244a',
    purpose: 'PRIVACY_INFORMATION',
    scope: ['RESERVATION', 'PAYMENT', 'COMMUNICATION', 'IMAGES'],
    route: '/confidentialite',
  },
  {
    id: 'legal-notice-2026-08-11',
    documentType: 'LEGAL_NOTICE',
    file: 'mentions legales.txt',
    expectedSha256: '45f0f15aa26b2a9f25e071ed2795e47eec3b4a9c5082f470ec4f6f0281593f71',
    purpose: 'LEGAL_INFORMATION',
    scope: ['WEBSITE'],
    route: '/mentions-legales',
  },
] as const);

const ownerSourcesDirectory = fileURLToPath(new URL('../../../docs/new docs/', import.meta.url));

export type LoadedOwnerLegalDocument = (typeof OWNER_LEGAL_SOURCES)[number] & {
  version: typeof OWNER_LEGAL_VERSION;
  sourceDocumentHash: string;
  noticeText: string;
  effectiveAt: Date;
  publishedAt: Date;
};

export const loadOwnerLegalDocuments = async (): Promise<LoadedOwnerLegalDocument[]> =>
  Promise.all(OWNER_LEGAL_SOURCES.map(async (source) => {
    const bytes = await readFile(`${ownerSourcesDirectory}${source.file}`);
    const sourceDocumentHash = createHash('sha256').update(bytes).digest('hex');
    if (sourceDocumentHash !== source.expectedSha256) {
      throw new Error(`OWNER_LEGAL_SOURCE_HASH_MISMATCH:${source.documentType}`);
    }
    return {
      ...source,
      version: OWNER_LEGAL_VERSION,
      sourceDocumentHash,
      noticeText: bytes.toString('utf8'),
      effectiveAt: OWNER_LEGAL_EFFECTIVE_AT,
      publishedAt: OWNER_LEGAL_PUBLISHED_AT,
    };
  }));
