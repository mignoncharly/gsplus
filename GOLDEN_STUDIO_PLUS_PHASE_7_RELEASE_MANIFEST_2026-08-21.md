# Golden Studio Plus — Phase 7 release and external-acceptance manifest

**Release date:** 21 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Production host:** `https://gsplus.vip`
**Status:** calendar presentation deployed; isolated external matrix awaiting dedicated QA destinations and human mailbox inspection

## Released implementation

- Cal.com attendee language now comes from the immutable reservation snapshot (`fr` or `en`) rather than a hard-coded French value.
- The supported Cal.com `bookingFieldsResponses.title` field receives the concise `GSP-… — Pack — Client` identifier.
- The supported `bookingFieldsResponses.notes` field contains only the reservation reference, localized Douala start/end, notification phone, localized payment-method label, protected admin link, and a fixed operational instruction.
- The same bounded operational values are retained as Cal.com metadata alongside the existing idempotency key and payload hash.
- Reservation `notes`, `extraInfo`, status reasons, transaction references, secrets, and other unrestricted internal/customer text are never included in the provider payload.
- The calendar payload hash now covers locale and payment method, so a recorded operation represents the presentation actually sent.
- A read-only production readiness command records sanitized application, catalogue, Cal.com, SMTP, WhatsApp, and aggregate ledger state without exposing credentials or recipient addresses.
- A read-only Chromium/WebKit production suite verifies every FR/EN catalogue CTA: 31 direct packages route to their exact reservation selection, four contact-mode packages route to contact, and the public contact pages expose genuine e-mail, telephone, and WhatsApp actions without placeholder links.

## Provider capability decision

The implementation was checked against the official Cal.com v2 booking API version `2026-02-25` and the event-type API version `2024-06-14`:

- Create booking accepts `attendee.language`, `bookingFieldsResponses`, `metadata`, and `lengthInMinutes`.
- Metadata is bounded to at most 50 keys, keys of at most 40 characters, and string values of at most 500 characters; the integration test enforces the applicable key/value limits.
- No supported per-booking top-level request field can override the provider-generated booking title.
- Event-type `title` and `customName` are provider/event-type configuration, not safe per-booking title inputs.

Official contracts:

- <https://cal.com/docs/api-reference/v2/bookings/create-a-booking>
- <https://cal.com/docs/api-reference/v2/event-types/update-an-event-type>

The live configured event type is `5733625`, titled `Golden Studio Plus - Studio Session`. It has `customName: null`, supports 15/30/45/60/90/120/180/240/360/480-minute durations, and exposes required custom field `title` plus optional field `notes`. Phase 7 therefore uses those supported fields and documents the provider limitation instead of sending an unsupported `title` property.

## Deployment evidence

- Backend TypeScript build passed before deployment.
- The production backend was gracefully recycled through its `Restart=always` service; PID changed from `1582611` to `1624735` (`node` worker `1624747`).
- Local production health returned `{"status":"ok","service":"golden-studio-plus-api"}`.
- Public calendar health returned `ok: true`, configured event type `5733625`, booking API `2026-02-25`, event-type API `2024-06-14`, and booking-list API `2026-05-01`.
- The readiness check observed 35 published packages: exactly 31 direct, four contact-mode, and one Happy Hours package.
- Zoho SMTP delivery is enabled and the configured sender identity contains `Golden Studio Plus`.
- WhatsApp delivery remains disabled and provider credentials remain absent; it is reported as `FEATURE_GATED_UNAVAILABLE`, never as production-validated.
- No migration or schema change was required.

## Verification evidence

- Focused Cal.com integration suite: 14/14 passed.
- Full backend suite: 188/188 passed across 26 files.
- Frontend unit/source suite: 108/108 passed.
- Backend TypeScript build passed.
- Phase 7 production CTA/contact suite: 6/6 passed across Chromium and WebKit.
- Read-only production readiness check passed for application health, catalogue contract, Cal.com capability, and Zoho SMTP configuration.
- `git diff --check`, readiness-script syntax, and `package.json` parsing passed.

## External acceptance status

| Requirement | Current evidence | Result |
| --- | --- | --- |
| CAL-03 supported calendar presentation | Code deployed; official/live capability checked; FR/EN payload tests green | Deployed, live create/inspect/cancel pending |
| Five isolated production journeys | No run performed without dedicated QA Gmail/Zoho addresses and phone | Pending external inputs |
| Four public lead forms in FR/EN | Automated logic exists; external delivery run intentionally not sent to an unspecified inbox | Pending external inputs |
| All direct-package and contact-mode CTAs | 31 direct + 4 contact packages and genuine public contact actions checked in both engines | Passed |
| Accepted/rejected reschedule and old/new Cal.com inspection | Automated integration evidence exists; fresh isolated provider run pending | Pending external inputs |
| Six Happy Hours and blocked seventh | Automated concurrency/quota evidence exists; fresh isolated production mutation pending | Pending external inputs |
| Useful and empty digest windows | Automated evidence exists; fresh mailbox evidence pending | Pending external inputs/human window |
| Exact sender identity and Gmail/Zoho mobile rendering | Transport/sender configuration checked; receipt/rendering cannot be inferred from SMTP acceptance | Human inspection required |
| WhatsApp consent/no-consent/retries/no duplicates | Feature gate is off and credentials are absent | Explicitly unavailable, not validated |

## Required inputs for the isolated external matrix

The production matrix must not guess recipients or send acceptance messages to ordinary customer addresses. Before execution, provide these values at invocation time (they are not committed):

- `PHASE7_QA_ZOHO_EMAIL`: a controlled Zoho mailbox;
- `PHASE7_QA_GMAIL_EMAIL`: a controlled Gmail mailbox;
- `PHASE7_QA_PHONE`: a controlled Cameroon QA phone;
- confirmation that the mailbox owner will inspect both mobile renderings and record receipt.

Run `npm run qa:phase7:readiness` from `backend/` after supplying those environment variables. WhatsApp scenarios remain excluded until real Meta Business credentials and approved templates are configured and a supervised proof is separately authorized.

No `TEST-AUDIT` token, simulation instruction, secret, or unrestricted internal note will be placed in any field eligible for customer delivery.
