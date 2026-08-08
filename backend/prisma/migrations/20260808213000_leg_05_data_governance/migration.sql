CREATE TABLE "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "triggerRule" TEXT NOT NULL,
    "activeRule" TEXT NOT NULL,
    "archiveRule" TEXT NOT NULL,
    "dispositionRule" TEXT NOT NULL,
    "backupRule" TEXT NOT NULL,
    "automaticExecution" BOOLEAN NOT NULL DEFAULT false,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRightsRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT,
    "requesterPhone" TEXT,
    "reservationReference" TEXT,
    "requestChannel" TEXT NOT NULL,
    "requestSummary" TEXT NOT NULL,
    "identityStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "identityEvidenceReference" TEXT,
    "processingRestricted" BOOLEAN NOT NULL DEFAULT false,
    "retentionAction" TEXT NOT NULL DEFAULT 'NONE',
    "responseSummary" TEXT,
    "responseEvidence" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "targetResponseAt" TIMESTAMP(3) NOT NULL,
    "legalHoldUntil" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "retentionPolicyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataRightsRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataRightsRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "identityStatus" TEXT NOT NULL,
    "identityEvidenceReference" TEXT,
    "processingRestricted" BOOLEAN NOT NULL,
    "retentionAction" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "responseEvidence" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataRightsRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataRetentionPolicy_category_key" ON "DataRetentionPolicy"("category");
CREATE INDEX "DataRetentionPolicy_status_effectiveAt_idx" ON "DataRetentionPolicy"("status", "effectiveAt");
CREATE UNIQUE INDEX "DataRightsRequest_reference_key" ON "DataRightsRequest"("reference");
CREATE INDEX "DataRightsRequest_status_targetResponseAt_idx" ON "DataRightsRequest"("status", "targetResponseAt");
CREATE INDEX "DataRightsRequest_requestType_receivedAt_idx" ON "DataRightsRequest"("requestType", "receivedAt");
CREATE INDEX "DataRightsRequest_retentionPolicyId_idx" ON "DataRightsRequest"("retentionPolicyId");
CREATE INDEX "DataRightsRequest_createdById_idx" ON "DataRightsRequest"("createdById");
CREATE UNIQUE INDEX "DataRightsRequestEvent_commandId_key" ON "DataRightsRequestEvent"("commandId");
CREATE INDEX "DataRightsRequestEvent_requestId_effectiveAt_createdAt_idx" ON "DataRightsRequestEvent"("requestId", "effectiveAt", "createdAt");
CREATE INDEX "DataRightsRequestEvent_recordedById_idx" ON "DataRightsRequestEvent"("recordedById");

ALTER TABLE "DataRightsRequest" ADD CONSTRAINT "DataRightsRequest_retentionPolicyId_fkey" FOREIGN KEY ("retentionPolicyId") REFERENCES "DataRetentionPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataRightsRequest" ADD CONSTRAINT "DataRightsRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataRightsRequestEvent" ADD CONSTRAINT "DataRightsRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataRightsRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataRightsRequestEvent" ADD CONSTRAINT "DataRightsRequestEvent_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "DataRetentionPolicy" ("id", "category", "label", "version", "triggerRule", "activeRule", "archiveRule", "dispositionRule", "backupRule", "automaticExecution", "effectiveAt", "updatedAt") VALUES
('retention-reservations-v1', 'RESERVATIONS', 'Réservations et exécution des services', '2026-07-31', 'Fin du service, annulation ou clôture du dossier', 'Conserver pendant l’exécution, le suivi client et les obligations associées', 'Restreindre après clôture lorsque la preuve ou la défense des droits reste nécessaire', 'Réviser avant anonymisation ou effacement; préserver les pièces légalement nécessaires', 'Les copies résiduelles suivent la rotation normale des sauvegardes sans réutilisation incompatible', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP),
('retention-payments-v1', 'PAYMENTS', 'Paiements et pièces financières', '2026-07-31', 'Clôture financière du dossier', 'Conserver pour vérification, remboursement, comptabilité et obligations fiscales', 'Archive à accès restreint pour les obligations financières, fiscales et probatoires', 'Aucun effacement avant revue des obligations applicables', 'Rotation normale; restauration limitée aux besoins de continuité et de preuve', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP),
('retention-consents-v1', 'CONSENTS', 'Acceptations, consentements et retraits', '2026-07-31', 'Fin de la portée du choix ou retrait', 'Conserver la preuve tant que l’utilisation ou la contestation reste possible', 'Archive restreinte de la version, de la date, de la finalité et de la portée', 'Anonymiser seulement après revue de la preuve et des responsabilités', 'Copies résiduelles isolées jusqu’à rotation normale', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP),
('retention-media-v1', 'MEDIA_WORK_FILES', 'Images et fichiers de travail', '2026-07-31', 'Production, livraison ou fin de l’archive convenue', 'Conserver pour la production, la livraison, la sécurité et l’archive convenue', 'Restreindre les fichiers maîtres et toute conservation probatoire', 'Supprimer ou anonymiser après revue des livraisons, autorisations et litiges', 'Aucune garantie de conservation permanente; résidus supprimés par rotation normale', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP),
('retention-logs-v1', 'TECHNICAL_LOGS', 'Journaux techniques et de sécurité', '2026-07-31', 'Fin du besoin opérationnel ou de sécurité', 'Conservation proportionnée au diagnostic, à la sécurité et à la prévention des abus', 'Accès restreint en cas d’incident, fraude ou enquête', 'Supprimer ou anonymiser après revue de sécurité et de contentieux', 'Résidus limités à la rotation normale et sans usage incompatible', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP),
('retention-backups-v1', 'BACKUPS', 'Sauvegardes', '2026-07-31', 'Rotation normale de la sauvegarde concernée', 'Conserver uniquement pour continuité, restauration et sécurité', 'Accès technique restreint; ne pas remettre une donnée effacée en usage courant', 'Élimination par rotation normale après validation des gels applicables', 'Les copies résiduelles restent inaccessibles pour toute réutilisation incompatible', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP),
('retention-rights-v1', 'RIGHTS_REQUESTS', 'Demandes d’exercice des droits', '2026-07-31', 'Clôture et preuve de la réponse administrative', 'Conserver pendant l’instruction, les actions et la réponse', 'Archive restreinte pour prouver le traitement et défendre les droits', 'Réviser avant anonymisation; ne conserver que la preuve nécessaire', 'Copies résiduelles isolées jusqu’à rotation normale', false, '2026-07-31T00:00:00.000Z', CURRENT_TIMESTAMP);
