# Owner-authorized deferred activation

Date: 2026-07-24 UTC

Status: Application activation complete; image publication, Zoho SMTP activation and verified hosting disclosure are live. WhatsApp, social links, Turnstile and Golden Studio Plus legal particulars are deferred. The authorized kernel reboot remains pending.

## Authorization

The owner explicitly authorized activation of the previously deferred SMTP, WhatsApp Business, Cloudflare Turnstile, legal particulars, official social URLs, supplied portfolio images and the pending kernel reboot. Authorization permits activation but does not supply missing credentials, identifiers, legal facts or URLs; none may be invented.

## Completed: supplied portfolio images

The owner's message is recorded as final publication approval for all 17 images staged in `private-media/phase8-curated/manifest.json`.

- All 17 staged entries and all 34 WebP derivatives were validated against the recorded sizes.
- Only the 480 px and 1024 px WebP derivatives were copied to `/uploads/portfolio`; source PNG files and private paths remain private.
- Seventeen published `MediaItem` records were created transactionally with six curated public categories.
- Seventeen audit records identify the owner-approval publication action.
- The private manifest and every item now record `publicationApproved: true`, an approval timestamp and the approval basis.
- The production API returns exactly 17 owner-approved records and exposes no private source path.
- All 34 public derivative responses return HTTP 200 with `image/webp`.
- Production portfolio acceptance: 6/6 passed across Chromium and WebKit. The gallery contains 17 API images plus the six established local fallbacks.

The gated publisher is `backend/scripts/publish-approved-media.mjs`. It requires the explicit `--owner-approved` argument and is idempotent by public primary URL.

## SMTP activation

Live DNS proves that `gsplus.vip` uses Zoho's EU data center (`mx.zoho.eu` and `include:zohomail.eu`). The prior `smtp.zoho.com` endpoint rejected authentication because it targeted the wrong data center. The existing protected credential passed authentication against `smtp.zoho.eu:587`, and one labeled activation email was accepted for the configured administrative recipient.

The backend environment now uses `SMTP_HOST=smtp.zoho.eu` and `EMAIL_DELIVERY_ENABLED=true`. All 48 backend tests and the TypeScript build pass. The owner restarted `goldenstudioplus-backend` and confirmed it is active, so this configuration is live. The outbox still contains no pending notification; 14 historical terminal failures remain untouched and will not be replayed automatically.

## Hosting disclosure

The hosting provider was independently verified from the production IP allocation and Hetzner's official legal notice. The public legal page now identifies Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Germany, with its official telephone, email, website and Ansbach registration HRB 6089. This hosting disclosure does not fill or imply any missing Golden Studio Plus company particulars.

The public privacy register now marks Zoho Mail SMTP active for transactional notifications. The frontend Node suite passes 28/28, lint passes, the local Phase 9 browser suite passes 6/6 across Chromium and WebKit, and the isolated production build passes prerendering and performance budgets. The exact validated artifact was deployed to `frontend/dist`; its deployed `index.html` SHA-256 is `ba8a18f33980e348eed7d24e94817e32396ae40294848ce298ff64e58035db8e`. The complete live Phase 8–11 regression suite passes 20/20 across Chromium and WebKit.

## Inputs still missing

### WhatsApp Business

The owner deferred WhatsApp activation for later. No account, credential or template creation is part of the current scope, and `WHATSAPP_DELIVERY_ENABLED` remains false.

### Cloudflare Turnstile

Turnstile was deferred as optional. The backend secret and frontend site key are absent. Turnstile remains disabled; honeypot and rate-limit protection remain active. A Cloudflare account is not required for the website's present operation. Both keys and frontend widget integration would be required only if the owner later chooses to add Turnstile.

### Official social URLs

The owner deferred social-link publication for later. No placeholder link is published.

### Legal company particulars

The owner explicitly deferred Golden Studio Plus legal form, share capital, RCCM, NIU and publication-director identity. These owner/company facts remain pending and are not inferred from the hosting provider. Verified Hetzner particulars are now published separately.

### Kernel reboot

The owner authorized the reboot, but it remains intentionally last so deployment and provider checks can finish first. After all available activations pass, reboot the server into the installed kernel and verify Nginx, PostgreSQL and `goldenstudioplus-backend` return healthy.

## Recovery evidence

The following mode-0600 assets were created before publication under the protected mode-0700 directory `.phase0-backups/20260722-204951`:

| Asset | SHA-256 |
|---|---|
| `database-pre-owner-activation.dump` | `d2c8ad3a26610d3d61f0547c445ad84c7a81f1776a15660cd3a8c7aa34141abb` |
| `uploads-pre-owner-activation.tar.gz` | `0ac0c64f3bed494ac0d29cbfe52760b812080cde47e69d205bc61d6d2f718896` |
| `phase8-manifest-pre-owner-activation.json` | `ba987da6717573f8949b2a63929c93d7fc4c4b2e338fdf02e858675362b54644` |
| `backend-env-pre-owner-activation` | `69461def618d09cdc5641a5a037d1767b26e6ad30bac661670c9aaa195b4f9d0` |
| `frontend-env-pre-owner-activation` | `14175b0b1c528da49880f7946a7556460a1f0cca817ba3d17b603565c3221803` |
| `frontend-dist-pre-owner-legal.tar.gz` | `1219ed535cf6881dc8c7ff3cc95f3e0a1f4473dbc9727be6f84961bc94edcbeb` |
| `owner-legal-code-preimage.tar.gz` | `c60865bb695eb7a972039337bcfae39b9992079076c7ec03b957f8507b3db927` |

The database dump has a valid `pg_restore` catalog, the upload archive is readable, and the complete protected `SHA256SUMS` manifest verifies successfully.
