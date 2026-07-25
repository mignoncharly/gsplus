# Phase 12 — Baseline, credential containment and source control

Date: 2026-07-25 UTC
Status: Complete before feature work
Canonical production origin: https://gsplus.vip

## Owner constraint

The owner explicitly required all existing working keys to remain unchanged. No credential was rotated, replaced, printed or tested by exposing its value. This report records containment and version-control hygiene only.

## Fresh protected recovery set

Recovery directory: `.phase0-backups/20260725-120406-pre-phase12`

The directory and all contents are owner-only. `SHA256SUMS` verifies the following recovery components:

- PostgreSQL custom-format dump with a readable `pg_restore` catalog.
- Exact deployed frontend distribution archive.
- Upload and protected-media archives.
- All supplied raw media and canonical logo sources.
- Pre-change source archive excluding secrets, dependencies and generated deployments.
- Deployed Nginx and backend systemd configuration archive.
- Current backend and frontend environment files.
- Plaintext deployment-key document relocated from normal documentation.
- Legacy source ZIP containing an old backend environment file, relocated from the project root.
- Quarantined abandoned owner/legal build.

## Credential containment

- `docs/keys_deploy.md` was moved to protected credential storage.
- `goldenstudioplus.zip` was moved to protected credential storage because it contains an old `backend/.env`.
- `backend/.env` and `frontend/.env` are mode `0600`.
- No working key was rotated or modified.
- `.gitignore` excludes runtime environments, credentials, recovery archives, database dumps, raw media masters, uploads and temporary artifacts.

## Residual cleanup

Eleven `.orig` files beside active sources were checked for an existing active counterpart, preserved in the pre-change source archive and removed. The abandoned `.build-owner-legal.pVBAuw` tree, including its seven `.orig` files and environment copy, was archived in protected recovery storage and removed from the normal project tree.

## Secret scan

Dedicated `gitleaks` and `trufflehog` binaries were not installed. A filename-only multi-pattern scan covered private-key blocks, common provider-token formats, credential-bearing connection URLs and assigned secret names while excluding protected backups, runtime media, generated deployments and dependencies.

Results:

- No private-key block was found in the normal project tree.
- Provider-token matches were false positives inside package integrity hashes and generated Prisma graph data.
- Credential-bearing URLs outside the ignored runtime environment were documented placeholders in example/test documentation.
- Assigned-secret matches in tracked source were configuration declarations, validation fields, test fixtures or documented placeholders.
- The only live credential values remain in ignored owner-only runtime/protected files.

## Runtime baseline

At capture time:

- Kernel: `6.8.0-136-generic`.
- Nginx: active.
- PostgreSQL: active.
- `goldenstudioplus-backend`: active.
- HTTPS API health: healthy.
- Cal.com configuration health: healthy.

## Restore procedure

1. Stop `goldenstudioplus-backend` and announce maintenance.
2. Verify `SHA256SUMS` before extracting any artifact.
3. Restore the PostgreSQL custom dump into the intended database with `pg_restore`; never overwrite production without a separately confirmed rollback decision.
4. Restore `uploads`, `private-media`, source and the exact frontend distribution as one coherent release.
5. Restore the reviewed Nginx and systemd files, then run `systemctl daemon-reload` and `nginx -t`.
6. Restore environment files with mode `0600` without printing their values.
7. Start PostgreSQL, the backend and Nginx; verify HTTPS, API health, admin authentication, portfolio media and Cal.com health.
8. Reconcile reservation, payment, lead, notification and calendar counts before reopening normal operations.

## Acceptance

The recovery artifacts are readable, their checksums pass, credential-bearing legacy files are no longer in normal documentation/source locations, residual `.orig` and temporary build files are absent from the project tree, and no working key was changed.
