# Golden Studio Plus — Phase 10 governance and security release manifest

**Release date:** 30 August 2026
**Status:** deployed to production; owner acceptance completed for the invitation, TOTP, session-revocation, audit-filter, audit-export, and deactivation workflows. Permission-grant and unusual-sign-in alert replays remain to be recorded.

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

## Production deployment and owner replay — 31 August 2026

- A verified, restore-listable production database backup was created before the release.
- `ADMIN_TOTP_ENCRYPTION_KEY` was generated separately from the session-signing key and stored only in the production environment file.
- The backend was restarted before migration because the previously pending Phase 9 backfill writes the `CREATIVE` lead enum value.
- Prisma applied `20260830160200_admin_phase_9_creative_backfill_after_deploy` and `20260830180000_admin_phase_10_governance`; a subsequent status check reported the production schema up to date.
- Backend release revision: `7cc32e2`; frontend invitation-form hotfix: `1db6032`.
- Public postflight checks: `/`, `/admin`, and `/api/health` returned HTTP 200; the new unauthenticated security route returned HTTP 401.
- The OWNER completed the controlled-account invitation, acceptance, sign-in, TOTP/recovery-code handling, device-session revocation, audit filtering/export, and test-account deactivation replay. No credential, token, recovery code, or personally identifying account address is recorded here.

### Remaining governance evidence

- Record a controlled per-module permission-grant replay and an unusual-sign-in alert replay before claiming the wider governance/security acceptance in §12 is fully closed.
