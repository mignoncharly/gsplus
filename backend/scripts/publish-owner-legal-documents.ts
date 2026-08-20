import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/db/prisma.js';
import { loadOwnerLegalDocuments } from '../src/legal/owner-legal-documents.js';

const apply = process.argv.includes('--apply');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--apply');
if (unknownArguments.length > 0) throw new Error(`Arguments inconnus : ${unknownArguments.join(', ')}`);

const normalizeJson = (value: unknown) => JSON.stringify(value);

const main = async () => {
  const documents = await loadOwnerLegalDocuments();
  const existing = await prisma.legalDocumentVersion.findMany({
    where: { OR: documents.map(({ documentType, version }) => ({ documentType, version })) },
  });
  const byKey = new Map(existing.map((document) => [`${document.documentType}:${document.version}`, document]));
  const mismatches: Array<{ documentType: string; fields: string[] }> = [];
  const pending = [];

  for (const document of documents) {
    const current = byKey.get(`${document.documentType}:${document.version}`);
    if (!current) {
      pending.push(document.documentType);
      continue;
    }
    const fields: string[] = [];
    if (current.id !== document.id) fields.push('id');
    if (current.status !== 'PUBLISHED') fields.push('status');
    if (current.sourceDocumentHash !== document.sourceDocumentHash) fields.push('sourceDocumentHash');
    if (current.noticeText !== document.noticeText) fields.push('noticeText');
    if (current.purpose !== document.purpose) fields.push('purpose');
    if (normalizeJson(current.scope) !== normalizeJson(document.scope)) fields.push('scope');
    if (current.effectiveAt.toISOString() !== document.effectiveAt.toISOString()) fields.push('effectiveAt');
    if (current.publishedAt.toISOString() !== document.publishedAt.toISOString()) fields.push('publishedAt');
    if (fields.length > 0) mismatches.push({ documentType: document.documentType, fields });
  }

  console.log(JSON.stringify({
    mode: apply ? 'PUBLISH' : 'CHECK_ONLY',
    version: documents[0]?.version,
    documents: documents.map(({ documentType, sourceDocumentHash, route }) => ({ documentType, sourceDocumentHash, route })),
    pending,
    alreadyPublished: documents.length - pending.length - mismatches.length,
    mismatches,
    archivedOrMutatedHistoricalVersions: 0,
  }, null, 2));
  if (mismatches.length > 0) throw new Error('OWNER_LEGAL_VERSION_CONFLICT');
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    for (const document of documents) {
      if (byKey.has(`${document.documentType}:${document.version}`)) continue;
      await tx.legalDocumentVersion.create({
        data: {
          id: document.id,
          documentType: document.documentType,
          version: document.version,
          status: 'PUBLISHED',
          sourceDocumentHash: document.sourceDocumentHash,
          noticeText: document.noticeText,
          purpose: document.purpose,
          scope: document.scope as unknown as Prisma.InputJsonValue,
          effectiveAt: document.effectiveAt,
          publishedAt: document.publishedAt,
        },
      });
    }
  });

  const published = await prisma.legalDocumentVersion.count({
    where: {
      OR: documents.map(({ documentType, version }) => ({ documentType, version, status: 'PUBLISHED' })),
    },
  });
  if (published !== documents.length) throw new Error('OWNER_LEGAL_PUBLICATION_POSTCONDITION_FAILED');
  console.log(JSON.stringify({ published, inserted: pending.length, historicalVersionsMutated: 0 }, null, 2));
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
