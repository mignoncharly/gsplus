# Golden Studio Plus — Phase 10 governance and security release manifest

**Release date:** 30 August 2026
**Status:** implementation complete; production migration, deployment, and credentialled acceptance remain operator actions

## Delivered scope

- Named admin accounts with one-time, hashed seven-day invitations and non-destructive deactivation.
- OWNER-managed role changes and additional per-module grants on top of the established typed permission set.
- TOTP enrollment, encrypted at rest, with eight one-time hashed recovery codes and a login prompt that does not disclose account existence before password verification.
- Device sessions with user agent, IP, last-seen, expiry, individual revocation, and global invalidation on password change/deactivation.
- Searchable/exportable audit entries and versioned admin-command records, plus sign-in attempt monitoring for repeated failures.
- A dedicated TOTP encryption key, independent from JWT signing, with a previous-key rollover window and documented operator procedure.

## Local verification

- Backend Prisma client generation and TypeScript build passed.
- Focused Phase 10 cryptography suite: 9 passed.
- Full admin API integration suite: 70 passed, including invitations, TOTP, device-session revocation, and audit visibility.
- Frontend production build passed, including client-only enforcement, prerendering, performance budgets, and tracker audit.

## Deployment checklist

1. Set `ADMIN_TOTP_ENCRYPTION_KEY` to an independent production secret before the first TOTP enrollment; leave `ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY` empty outside a rotation window.
2. Apply `prisma migrate deploy`; verify there are no pending migrations.
3. Build backend and frontend, activate the release, restart the backend, and check `/health`.
4. As an OWNER, invite a controlled account, accept the invitation, configure TOTP, save recovery codes off-system, list/revoke a test device session, and export a filtered audit view.
5. Record the production replay and resulting release revision here before declaring §12 closed.

## Required production acceptance

The report’s Phase 10 acceptance is considered complete only after the owner has confirmed on `https://gsplus.vip/admin` that named accounts, deactivation, per-module rights, TOTP/recovery codes, device revocation, audit filtering/export, and unusual sign-in alerts operate as described. No production credential, recovery code, provisioning URI, or invitation token belongs in this manifest.
