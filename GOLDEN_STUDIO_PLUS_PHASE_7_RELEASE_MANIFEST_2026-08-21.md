# Golden Studio Plus — Phase 7 release and external-acceptance manifest

**Release date:** 21 August 2026
**Branch:** `codex/phase7-external-acceptance-20260821`
**Production host:** `https://gsplus.vip`
**Status:** implementation and isolated external matrix complete; Gmail/Zoho mobile receipt and rendering confirmation remains human

## Released implementation

- Cal.com attendee language comes from the immutable reservation snapshot (`fr` or `en`).
- Supported `bookingFieldsResponses.title` receives the concise `GSP-… — Pack — Client` identifier.
- Supported `bookingFieldsResponses.notes` contains only the reference, localized Douala start/end, notification phone, localized payment label, protected admin link, and a fixed operational instruction.
- The same bounded operational values are retained as provider metadata. Free notes, `extraInfo`, status reasons, transaction references, secrets, and unrestricted text are excluded.
- Calendar payload hashes cover locale and payment method.
- Accepted reschedules send Cal.com's supported `rescheduledBy` field using the immutable notification email. This was added after live acceptance exposed HTTP 400 from the incomplete reschedule request.
- The guarded production runner requires an explicit execution flag, fixed run ID, controlled destination environment variables, WhatsApp-disabled state, duplicate-run refusal, provider-valid slot intersection, terminal cleanup, and private evidence permissions.
- The reconciliation command independently verifies database, SMTP, Cal.com, quota, lead, refund, reminder, and notification state before writing sanitized evidence.

## Provider capability and contract

The implementation uses the official Cal.com v2 contracts:

- Booking and reschedule API: `2026-02-25`
- Event-type API: `2024-06-14`
- Slots API: `2024-09-04`
- Booking-list API: `2026-05-01`

Official contracts:

- <https://cal.com/docs/api-reference/v2/bookings/create-a-booking>
- <https://cal.com/docs/api-reference/v2/bookings/reschedule-a-booking>
- <https://cal.com/docs/api-reference/v2/slots/get-available-time-slots-for-an-event-type>
- <https://cal.com/docs/api-reference/v2/event-types/update-an-event-type>

The live event type is `5733625`, titled `Golden Studio Plus - Studio Session`. It supports 15/30/45/60/90/120/180/240/360/480-minute durations, uses a 30-minute start interval, and exposes required custom field `title` plus optional `notes`. The production matrix intersects application slots with live Cal.com slots so provider-backed journeys cannot select unsupported quarter-hour starts or host-unavailable times.

## Deployment evidence

- Backend TypeScript build passed.
- Focused calendar integration suite passed 14/14.
- Full backend suite passed 188/188 across 26 files.
- The rebuilt backend was activated; parent PID changed from `1624735` to `1720937`, with Node worker `1720953`.
- Public health returned `{"status":"ok","service":"golden-studio-plus-api"}`.
- No migration or schema change was required.
- WhatsApp credentials remain absent and delivery remains feature-gated off.

## Isolated external matrix

Controlled destinations:

- Zoho: `info@gsplus.vip`
- Gmail: `goldenstudplus@gmail.com`
- Cameroon QA phone: `+237673026654`
- WhatsApp consent: false on all journeys and leads
- Primary run: `GSP-P7-20260821-005`

| Journey | Locale/channel | Workflow | Terminal result |
| --- | --- | --- | --- |
| A — `GSP-260821-G7AF` | FR / Orange Money | Combined verify-confirm; Cal.com create; accepted reschedule; Cal.com update; customer cancellation >48h; partial refund completed | Reservation cancelled; payment refunded; provider bookings cancelled |
| B — `GSP-260821-Z6MZ` | EN / MTN MoMo / Happy Hours | Payment information required; payment rejection; reservation rejection | Reservation and payment rejected |
| C — `GSP-260821-DKAD` | EN / Orange Money | Combined verify-confirm; Cal.com create; injected 24h scheduler window; E-16 sent; Studio cancellation; full refund | Reservation cancelled; payment refunded; provider booking cancelled |
| D — `GSP-260821-27JB` | FR / Orange Money | Near-term customer cancellation within 48h; no-refund policy; synthetic payment closure | Reservation cancelled; payment rejected; no financial task |
| E — `GSP-260821-EZJR` | EN / Orange Money | Payment verified then reservation confirmed within five minutes; E-03 cancelled; E-05 sent; rejected reschedule; Studio cancellation; full refund | Reservation cancelled; payment refunded; provider booking cancelled |

Additional production evidence:

- Six isolated Happy Hours holds consumed the daily quota; the seventh returned `PACKAGE_DAILY_QUOTA_REACHED`. Every auxiliary hold was immediately expired after proof.
- Four FR/EN CONTACT/B2B/QUOTE leads were created through the production application service, notified, and archived.
- Accepted and rejected reschedule decisions both passed.
- Cal.com create/update/cancel and localized title/notes/metadata inspection passed in French and English.
- One partial-refund task and two full-refund tasks reached `COMPLETED`; Journey D created no refund task.
- The useful operations digest reached `SENT`.
- An empty digest was not forced because the real operational ledger was non-empty; the scheduler's empty-state behavior remains covered by automated tests.
- SMTP accepted 44 R5 emails with provider message IDs; four obsolete scheduled events were cancelled and no R5 email remains pending or processing.
- No R5 reservation, financial task, Cal.com booking, lead, or quota hold remains active.
- Private evidence: `private-media/qa-evidence/GSP-P7-20260821-005.json`, mode `0600` (excluded from the release commit).

Runs `001` through `004` stopped on guarded assertions while the live provider contract and slot constraints were being resolved. Every record created by those attempts was terminalized, every refund task completed, every exact QA hold expired, every provider booking cancelled, and stale calendar retries were marked superseded by the existing worker state proof. Their controlled emails may also be visible in the supplied QA inboxes.
The preliminary R3-A and R4-A no-refund cancellations retain `VERIFIED` synthetic payment audit states because the transition model does not rewrite an authorized payment after a policy-valid no-refund cancellation; both reservations are cancelled, have no financial task, and have no active provider event.

## Verification summary

- Focused Cal.com integration: 14/14 passed.
- Full backend: 188/188 passed across 26 files.
- Frontend unit/source: 108/108 passed (unchanged from the deployed Phase 7 baseline).
- Production Chromium/WebKit CTA/contact suite: 6/6 passed.
- Production readiness: application, 35-package catalogue, Cal.com event type, and Zoho SMTP ready.
- R5 reconciliation: 15/15 named acceptance groups passed.
- `git diff --check`, script syntax, evidence permissions, and `package.json` parsing passed.

## Remaining human acceptance

SMTP acceptance proves that the configured server accepted the messages; it does not prove inbox placement or mobile rendering. The mailbox owner must inspect both controlled inboxes on mobile and confirm:

- receipt in Zoho and Gmail, including spam/junk if necessary;
- sender name is exactly Golden Studio Plus;
- FR and EN subjects/content are readable;
- buttons/links work;
- layout has no clipping or horizontal scrolling;
- no message contains prohibited QA/simulation wording.

WhatsApp is explicitly unavailable, not production-validated. It remains excluded until real Meta Business credentials and approved templates are configured and a separately supervised proof is authorized.
