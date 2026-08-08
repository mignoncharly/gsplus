ALTER TABLE "DataRetentionPolicy"
  ADD CONSTRAINT "DataRetentionPolicy_category_check" CHECK ("category" IN ('RESERVATIONS', 'PAYMENTS', 'CONSENTS', 'MEDIA_WORK_FILES', 'TECHNICAL_LOGS', 'BACKUPS', 'RIGHTS_REQUESTS')),
  ADD CONSTRAINT "DataRetentionPolicy_status_check" CHECK ("status" IN ('PUBLISHED', 'ARCHIVED')),
  ADD CONSTRAINT "DataRetentionPolicy_manual_only_check" CHECK (NOT "automaticExecution");

ALTER TABLE "DataRightsRequest"
  ADD CONSTRAINT "DataRightsRequest_type_check" CHECK ("requestType" IN ('ACCESS', 'RECTIFICATION', 'RESTRICTION', 'OBJECTION', 'PORTABILITY', 'CONSENT_WITHDRAWAL', 'ERASURE')),
  ADD CONSTRAINT "DataRightsRequest_status_check" CHECK ("status" IN ('RECEIVED', 'IDENTITY_CHECK', 'IN_REVIEW', 'ACTION_REQUIRED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REFUSED', 'CLOSED')),
  ADD CONSTRAINT "DataRightsRequest_identity_check" CHECK ("identityStatus" IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'NOT_REQUIRED')),
  ADD CONSTRAINT "DataRightsRequest_identity_evidence_check" CHECK ("identityStatus" <> 'VERIFIED' OR "identityEvidenceReference" IS NOT NULL),
  ADD CONSTRAINT "DataRightsRequest_retention_action_check" CHECK ("retentionAction" IN ('NONE', 'KEEP_ACTIVE', 'RESTRICTED_ARCHIVE', 'ANONYMIZATION_REQUIRED', 'ERASURE_REQUIRED', 'LEGAL_HOLD')),
  ADD CONSTRAINT "DataRightsRequest_target_check" CHECK ("targetResponseAt" >= "receivedAt"),
  ADD CONSTRAINT "DataRightsRequest_response_evidence_check" CHECK ("status" NOT IN ('PARTIALLY_FULFILLED', 'FULFILLED', 'REFUSED', 'CLOSED') OR "responseEvidence" IS NOT NULL),
  ADD CONSTRAINT "DataRightsRequest_closed_at_check" CHECK (("status" = 'CLOSED') = ("closedAt" IS NOT NULL));

ALTER TABLE "DataRightsRequestEvent"
  ADD CONSTRAINT "DataRightsRequestEvent_type_check" CHECK ("eventType" IN ('CREATED', 'UPDATED', 'CLOSED')),
  ADD CONSTRAINT "DataRightsRequestEvent_status_check" CHECK ("toStatus" IN ('RECEIVED', 'IDENTITY_CHECK', 'IN_REVIEW', 'ACTION_REQUIRED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REFUSED', 'CLOSED')),
  ADD CONSTRAINT "DataRightsRequestEvent_identity_check" CHECK ("identityStatus" IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'NOT_REQUIRED')),
  ADD CONSTRAINT "DataRightsRequestEvent_retention_action_check" CHECK ("retentionAction" IN ('NONE', 'KEEP_ACTIVE', 'RESTRICTED_ARCHIVE', 'ANONYMIZATION_REQUIRED', 'ERASURE_REQUIRED', 'LEGAL_HOLD'));

CREATE FUNCTION "gsp_prevent_retention_policy_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'RETENTION_POLICY_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "DataRetentionPolicy_immutable"
BEFORE UPDATE OR DELETE ON "DataRetentionPolicy"
FOR EACH ROW EXECUTE FUNCTION "gsp_prevent_retention_policy_mutation"();

CREATE FUNCTION "gsp_prevent_data_rights_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "DataRightsRequest" WHERE "id" = OLD."requestId"
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'DATA_RIGHTS_EVENT_IMMUTABLE';
END;
$$;

CREATE TRIGGER "DataRightsRequestEvent_immutable"
BEFORE UPDATE OR DELETE ON "DataRightsRequestEvent"
FOR EACH ROW EXECUTE FUNCTION "gsp_prevent_data_rights_event_mutation"();
