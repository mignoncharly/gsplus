# Golden Studio Plus — Phase 10 secret-rotation procedure

This is the operating procedure for the administration secrets added in Phase 10. It is intentionally separate from normal account administration: values are changed only by the deployment operator, never in the web interface or in an audit export.

## Before any rotation

1. Schedule a short maintenance window and ensure two active OWNER accounts can sign in with their authenticator applications and have their recovery codes available.
2. Record the current deployed revision and confirm a database backup is available. Do not copy any secret into the ticket, audit log, browser, shell history, or this document.
3. Generate each new value with a cryptographically secure generator. Use independent values for `ADMIN_SESSION_SECRET` and `ADMIN_TOTP_ENCRYPTION_KEY`.
4. Update the root-owned production environment file with restrictive permissions, rebuild the backend, restart it, and verify `/health` locally. Do not place secrets in frontend build variables.

## Rotate `ADMIN_SESSION_SECRET`

1. Set a new `ADMIN_SESSION_SECRET`; leave `ADMIN_TOTP_ENCRYPTION_KEY` unchanged.
2. Restart the backend. Existing administrator JWTs immediately become invalid, which is expected; all administrators sign in again.
3. Verify a password-only account and a TOTP-enrolled account can both sign in. Confirm the Security screen shows the new session and that an audit entry exists for the first successful sign-in.
4. The old session secret must not remain anywhere in the active environment. It remains only in the protected secret-management history according to the host policy.

## Rotate `ADMIN_TOTP_ENCRYPTION_KEY` without locking out enrolled accounts

1. Put the existing value in `ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY` and put the new value in `ADMIN_TOTP_ENCRYPTION_KEY`. Do not change `ADMIN_SESSION_SECRET` in the same deployment unless an incident requires it.
2. Restart the backend. During this bounded rollover window, an enrolled account may authenticate using the previous key; each successful TOTP or recovery-code use transparently re-encrypts that account’s stored secret with the new key.
3. Ask every active enrolled account to sign in once. In the Security screen, confirm active sessions and normal two-factor status. The deployment operator verifies migration progress from the database only; no TOTP secret is read or exported.
4. After every active enrolled account has signed in, remove `ADMIN_TOTP_ENCRYPTION_PREVIOUS_KEY` and restart. Retain neither key in application logs.
5. If an inactive account later needs access before it has migrated, temporarily restore the bounded previous-key value, have that account sign in once, then remove it again. For a suspected key compromise, do not restore it: disable/re-enrol the affected account under incident control.

## Incident response and alerts

- The owner checks **Sécurité → Alertes de connexion** after any alert and at least weekly. Five failed attempts for one account or ten from one IP address in 24 hours appear there.
- On suspicion of compromise, revoke the affected device session immediately from **Sessions actives**, deactivate the account if ownership is uncertain, rotate `ADMIN_SESSION_SECRET`, and preserve the audit export before remediation.
- Recovery codes are shown only at TOTP activation and are stored hashed. If they are lost, the owner disables and re-enrols TOTP after identity verification; no code can be retrieved from the system.

## Post-rotation evidence

Record the date, operator identity, secret class rotated, application revision, backend health result, successful reauthentication, and any session revocations in the audited administration workflow. Never record a secret, TOTP provisioning URI, recovery code, IP address beyond the existing audit/sign-in screen, or raw authentication cookie.
