Continue the Golden Studio Plus project in `/var/www/goldenstudioplus`.

First read:

1. `docs/owner-authorized-activation-2026-07-24.md`
2. `docs/phase-11-security-hardening-2026-07-24.md`
3. `docs/audit-acceptance-matrix-2026-07-22.md`
4. `golden_studio_manual_completion_checklist.md`

Phases 0–11 remain complete. The owner has now explicitly authorized the formerly deferred provider/content activation and kernel reboot, but authorization does not supply missing credentials, URLs or legal facts.

## Completed after Phase 11

- All 17 supplied portfolio images have explicit owner publication approval; their 34 WebP derivatives are public and production portfolio acceptance passes 6/6.
- Zoho EU SMTP authentication and one labeled delivery test passed. `backend/.env` uses `smtp.zoho.eu` with future email delivery enabled. Backend tests pass 48/48, the build passes, and the owner restarted `goldenstudioplus-backend` and confirmed it active. SMTP is live.
- Verified Hetzner hosting particulars and active Zoho transactional-mail status are published. Frontend Node tests pass 28/28, lint passes, local legal browser tests pass 6/6, and the deployed Phase 8–11 production suite passes 20/20 across Chromium and WebKit.
- The 14 historical failed email events remain terminal and must not be replayed automatically.
- Fresh pre-activation recovery assets are protected and verified; see the activation report.

## Current blockers

- Turnstile is optional and was deferred. Existing honeypot and rate-limit protection remains active; no Cloudflare account is required for the present site.
- Golden Studio Plus legal form, capital, RCCM, NIU and publication-director identity were explicitly deferred. Verified Hetzner hosting particulars are already live and remain separate from these company facts.
- WhatsApp Business and official social links were deferred again by the owner.
- Application work is green. The authorized kernel reboot from running `6.8.0-117-generic` into installed `6.8.0-136-generic` is the only pending operational action, followed by service and HTTPS checks.

Do not invent or expose values. Ask the owner to place secrets directly in protected environment files. Keep historical notification replay a separate explicit decision.

## Production baseline to preserve

- Canonical origin: `https://gsplus.vip`
- Backend: `goldenstudioplus-backend`, loopback `127.0.0.1:4000`
- Ten database migrations applied
- Phase 11 backend suite: 48/48
- Frontend Node suite: 28/28; lint and performance budgets pass
- Phase 11 production browser suite: 20/20
- Protected recovery directory: `.phase0-backups/20260722-204951`
- Deployed Nginx SHA-256: `5c619ce679f72849fe003a75c373f5b5ab30f46b5f782853661e624ddf3f3bee`

Before any further production mutation, extend the recovery set as necessary. Build frontend changes in an isolated directory, publish only exact verified artifacts, and preserve the recovery evidence. The next action is the authorized reboot. After reboot, verify `uname -r`, Nginx, PostgreSQL, the backend, HTTPS, API health and portfolio health.
