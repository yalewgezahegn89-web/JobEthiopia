# Deployment Guide

## Requirements

- Node.js 20 LTS recommended (minimum 18.18.0)
- PostgreSQL
- npm

## Required Environment Variables

| Variable | Purpose | Required | Secret |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/dbname`) | Yes | Yes |
| `APP_BASE_URL` | Public origin for CSRF, sitemap, robots, and password-reset links (e.g. `https://jobs.example.com`) | Yes | No |
| `INGESTION_API_KEY` | API key required for job ingestion endpoints | Yes | Yes |
| `INGESTION_ORGANIZATION_ID` | Organization that API-key direct `POST /api/jobs` creation is attributed to. Trusted server-side context — callers can never set `organizationId` themselves. Direct job creation returns 500 if unset. | Yes | No |
| `MAINTENANCE_API_KEY` | API key required for the maintenance run endpoint | Yes | Yes |

### Optional

| Variable | Purpose | Required | Secret |
|---|---|---|---|
| `TRUSTED_CLIENT_IP_HEADER` | Header name overwritten by a trusted reverse proxy with the real client IP (e.g. `x-real-ip`). Only set when a proxy is in use. | No | No |

### Bootstrap-Only

These are only used when manually running the first-admin bootstrap command. They are not read at application startup.

| Variable | Purpose | Required | Secret |
|---|---|---|---|
| `ADMIN_BOOTSTRAP_EMAIL` | Email for the initial SUPER_ADMIN account | For bootstrap | Yes |
| `ADMIN_BOOTSTRAP_PASSWORD` | Password for the initial SUPER_ADMIN account | For bootstrap | Yes |

## Production Environment Notes

- `APP_BASE_URL` is **required** in production and must be the real public HTTPS
  origin (e.g. `https://jobs.example.com`). The application fails fast in
  production if it is missing or blank; it never silently falls back to
  `http://localhost:3000` outside of local development. This base is used for
  CSRF origin validation, sitemap/robots, and password-reset/email links.
- **On Vercel, `APP_BASE_URL` must be a BUILD-TIME environment variable.** The
  root `metadataBase`, `sitemap.ts`, and `robots.ts` are evaluated at
  build/static-generation time, when `NODE_ENV=production`. If it is unset at
  build time these fail fast, so configure it in the build/preview environment
  (not runtime-only) so `next build` succeeds and canonical URLs are correct.
- **CI build environment:** the GitHub Actions workflow supplies
  `APP_BASE_URL: http://localhost:3000` to its `build` step only, so the CI
  build is green without a real domain. This is a non-production placeholder
  scoped to the build step; it does **not** change the production fail-fast
  behavior. The production build/release environment must still set the real
  HTTPS origin.
- HTTPS is **required** in production. Secure/session cookies depend on
  `NODE_ENV=production`.
- **TLS edge responsibility:** the application layer emits CSP (nonce-based),
  `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy`. The
  reverse proxy / TLS terminator / CDN is responsible for enforcing HTTPS,
  **Strict-Transport-Security (HSTS)**, and **Permissions-Policy**; these are
  deliberately not emitted by the application.
- API keys must be stored in the hosting platform's secret/env system, never in code.
- `TRUSTED_CLIENT_IP_HEADER` must be configured **only** when a trusted reverse
  proxy sanitizes/overwrites that header with the real client IP. It is never
  enabled by header presence; arbitrary `x-forwarded-for` is never trusted by
  default. When unset in a proxied deployment, all clients share one rate-limit
  bucket (127.0.0.1 fallback).

## Database Deployment

1. Configure `DATABASE_URL`.
2. Apply migrations:
   ```bash
   npm run db:migrate
   ```
3. Build:
   ```bash
   npm run build
   ```
4. Start:
   ```bash
   npm run start
   ```

### Migration Notes

- `npm run db:migrate` applies tracked Drizzle migrations. This is the correct production workflow.
- `npm run db:push` pushes schema directly and bypasses the migration chain. Do **not** use it in production.
- Migrations are forward-only. There are no rollback SQL scripts. Take a database backup before risky production schema changes.
- Migration `0009_add_candidate_profiles` adds the private `candidate_profiles` table (one row per candidate). It uses no external storage or new providers. Profile data is private and only surfaced to employers reviewing an application from that candidate. Deleting a user cascades to their profile row.
- Migration `0010_add_application_resumes` adds the private `application_resumes` table (one row per application that has an uploaded resume). Resume files are stored in a private S3-compatible object bucket, never in the local filesystem. Deleting a user cascades to their application rows, which cascade to resume metadata. The resume feature degrades gracefully when storage is not configured.

### Connection Pool & TLS (Batch 98)

The PostgreSQL pool is configured to be safe for managed/serverless production
with conservative, environment-tunable settings (no new dependency):

| Setting | Default | Env variable |
|---|---|---|
| Connection timeout | 10s (finite; pg default is infinite) | `PG_CONNECTION_TIMEOUT_MS` |
| Max pool clients | 10 | `PG_POOL_MAX` |
| Idle timeout | 30s | `PG_IDLE_TIMEOUT_MS` |
| TLS | Auto in production | `PG_DISABLE_SSL` |

TLS behavior:
- **Production (NODE_ENV=production):** SSL is enabled with default CA
  verification (`rejectUnauthorized: true`) for managed PostgreSQL, unless
  (a) `PG_DISABLE_SSL=true` is set, or (b) the `DATABASE_URL` already declares
  an `sslmode=...` query parameter (e.g. `sslmode=require` for providers that
  need an explicit mode or a custom CA) — in that case the URL's `sslmode`
  governs.
- **Non-production:** SSL is not forced, preserving existing local/dev behavior.
- Certificates are never hard-coded in the application. The pool is created
  once at module load and shared process-wide; it is not recreated per request.

## Database Backup & PITR

Before relying on the database for production traffic, configure **backups with
point-in-time recovery (PITR)** through your PostgreSQL provider and test a
restore. This is a release blocker, not a nice-to-have: migrations are
forward-only with **no rollback SQL scripts**, so the backup is the only
recovery path for a failed migration or data-loss incident.

Recommended:

1. Enable **continuous WAL archiving / PITR** (e.g. Neon's branch-and-time-travel,
   Supabase's PITR daily+streaming, RDS automated backups + PITR, or Managed
   PostgreSQL equivalents).
2. Set a **retention policy** appropriate to compliance needs (e.g. 7–30 days of
   PITR, plus a weekly full snapshot retained longer if required).
3. **Test a restore at least once before go-live and quarterly thereafter**:
   restore a recent point to an isolated database, run `npm run db:migrate` (it
   should be a no-op if the restored point already matches the deployed schema),
   run the smoke tests (§ Launch Checklist), and confirm data integrity.
4. Record the restore runbook somewhere an on-call engineer can find it (a run
   book page, not just this file).

### First Admin Bootstrap

The first SUPER_ADMIN must be created manually after database setup:

1. Set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` environment variables.
2. Run:
   ```bash
   npx tsx src/db/bootstrapAdmin.ts
   ```

Notes:
- This command does **not** run automatically at application startup.
- It is idempotent: if an account with that email already exists, it is a no-op.
- The password is hashed with scrypt and never stored in plaintext.

## Seeding (Development Only)

```bash
npm run db:seed
```

This populates development data. Do **not** run this against a production database.

## Health Check

`GET /api/health` returns:

- `200` with `{"status":"ok"}` when the database is reachable.
- `503` with `{"status":"error"}` when the database is unreachable.

No authentication is required. This endpoint is suitable for uptime and readiness monitoring. It contains no internal diagnostic details.

## Observability

- Structured JSON is emitted to stdout/stderr.
- Each request is assigned a correlation ID via the `x-request-id` response header.
- Logs are redacted of sensitive fields (passwords, tokens, API keys, etc.).
- Platform log capture (Vercel function logs, Docker stdout, systemd journal, etc.) is expected.

## Password Reset / Email

Batch 75 established the email transport abstraction. Batch 83 wires live
transactional email via [Resend](https://resend.com).

### Without email provider configuration

- Password-reset tokens are created and stored, but **no email is sent**.
- Application-status change notifications are silently skipped.
- The application continues to function normally; the noop transport is used.
- Development and CI require no email provider setup.

### With email provider configuration

Set the following environment variables:

| Variable | Purpose | Required | Secret |
|---|---|---|---|
| `RESEND_API_KEY` | Resend API authentication key | Yes | Yes |
| `EMAIL_FROM` | Sender address (must be from a verified Resend domain) | Yes | No |
| `EMAIL_REPLY_TO` | Optional reply-to address | No | No |

**Domain verification:** Resend requires DNS-based domain verification before
sending from a custom domain. During development, `onboarding@resend.dev` is
available for testing (limited to 100 emails/day).

**`APP_BASE_URL`** must be the production HTTPS origin (e.g. `https://jobs.example.com`).
Password-reset links and application-status notification links use this as the base.

### Email behavior

- **Password reset:** A live reset email is sent when `RESEND_API_KEY` is configured.
  On provider failure, the generic user-facing response is unchanged (no account enumeration).
- **Application status change:** Candidates receive an email when their application
  status changes to REVIEWING, SHORTLISTED, or REJECTED. Email failure does not
  roll back the status change.
- **Application submission confirmation:** Candidates receive one transactional
  confirmation email when a new application is successfully created. The
  confirmation links to `/applications/{id}` using `APP_BASE_URL`. Email
  failures do not roll back application creation and never fail the submission.
- **No marketing email support.**
- **No notification preferences system.**
- **No retry queue or delivery status tracking.**

## Resume Storage (Batch 89)

Per-application PDF resumes are stored in a **private** S3-compatible object
bucket (Amazon S3 or Cloudflare R2) and served through a streaming server-side
proxy. No public or signed URLs are ever generated; the client only calls the
application API, which enforces tenant isolation.

Configure the required variables:

| Variable | Purpose | Required | Secret |
|---|---|---|---|
| `RESUME_STORAGE_ENDPOINT` | S3-compatible endpoint URL (omit for AWS S3; set for R2 or MinIO) | No | No |
| `RESUME_STORAGE_REGION` | Region (e.g. `auto` for R2; your AWS region for S3) | Yes | No |
| `RESUME_STORAGE_BUCKET` | Private bucket name | Yes | No |
| `RESUME_STORAGE_ACCESS_KEY_ID` | Provider access key | Yes | Yes |
| `RESUME_STORAGE_SECRET_ACCESS_KEY` | Provider secret key | Yes | Yes |
| `RESUME_STORAGE_FORCE_PATH_STYLE` | `true` for path-style providers (e.g. MinIO) | No | No |

Notes:
- **Missing configuration is not fatal.** When any required variable is unset,
  the app boots and runs normally; resume upload/download/delete return neutral
  503/500 responses and candidate browsing, applications, and the dashboard all
  continue to work.
- **Buckets must be private.** Do not enable public access or generate
  signed URLs.
- Candidates upload PDF resumes (max 5 MB) for each application they own and can
  replace or remove them. Employers can download the resume of an application
  they are authorized to review (active org admin of the owning organization).
- Uploads are rate-limited (5 per 60 minutes per client IP via a dedicated
  bucket).
- No anti-malware scanner is integrated. Files are validated as PDF-only by
  extension, MIME type, size, and PDF magic bytes, but are **not** scanned for
  malware. Consider scanning uploads at the provider layer if this is a
  requirement.
- No local filesystem storage is used.

## Maintenance

A scheduled maintenance run refreshes derivation / low-priority internal
state (e.g. recomputing computed fields, cleaning up stale records). Invoke it
via cron:

```bash
POST /api/internal/maintenance/run
Headers: x-maintenance-key: <MAINTENANCE_API_KEY>
```

- Authenticated only by the `MAINTENANCE_API_KEY` header; returns `401` on a
  missing/mismatched key.
- **Not idempotent-safe to run concurrently — schedule a single instance**
  (e.g. once daily, cron `0 3 * * *` UTC) and avoid overlapping runs. A run
  already in progress guard is **not** enforced, so do not overlap it.
- In a serverless/scale-to-zero deployment, a cron schedule may cold-start the
  function or the run may be short-lived; prefer a time window with a retry and
  confirm the run completes in the logs.
- Requires `MAINTENANCE_API_KEY` at **deploy/runtime** time (not just build).

## Vercel Readiness

Vercel is a plausible deployment target because this is a Next.js application using the Node runtime.

Batch 78 does **not** configure Vercel. If deploying to Vercel:

- No `vercel.json` is required for this foundation.
- Node runtime is required (not Edge runtime).
- PostgreSQL connection pooling should be validated for serverless deployment before high-concurrency production use.
- Platform-specific DB SSL settings are deployment-specific.
- Live deployment requires production environment variables to be configured in the Vercel dashboard.

## Generic Node Deployment

```bash
npm ci
npm run db:migrate
npm run build
npm run start
```

Notes:
- `DATABASE_URL` is required for migration and runtime.
- `PORT` can be supplied by the host; Next.js defaults to 3000.
- Use a reverse proxy for HTTPS in production.

## Rollback

There is no database rollback: migrations are forward-only and there are no
rollback SQL scripts. Recover by restoring a pre-deploy backup/PITR point
(§ Database Backup & PITR) or, when the schema change is backward-compatible,
by rolling the application build back and leaving the schema in place.

Application rollback:

1. Identify the last known-good build and redeploy it (Vercel instant rollback
   or redeploy of the previous image).
2. If the rollback is schema-related and the database must also regress, use
   the backup/PITR restore procedure instead of trying to reverse a migration.
3. Re-run the smoke tests and confirm the maintenance cron and health endpoint.

## Launch / Deployment Smoke-Test Checklist

Run these after every production deployment and after a PITR restore:

**Infra & config**
- [ ] `GET /api/health` returns `200 {"status":"ok"}`.
- [ ] `APP_BASE_URL` is the real HTTPS origin and resolves; `/sitemap.xml` and
      `/robots.txt` use it (no `localhost`); page `metadata` canonical URLs use it.
- [ ] HTTPS enforced at the edge (HTTP→HTTPS redirect), HSTS + Permissions-Policy
      present (edge responsibility), and app-emitted CSP / X-Content-Type-Options
      / X-Frame-Options / Referrer-Policy headers present on responses.
- [ ] `TRUSTED_CLIENT_IP_HEADER` (if set) reflects the real client IP and
      rate-limit headers/buckets behave per-client.
- [ ] Log aggregation working; entries have `x-request-id` correlation IDs and
      no secrets/plaintext tokens.

**Auth & email**
- [ ] Login/logout and session-cookie flags correct (`Secure`, `HttpOnly`).
- [ ] Password reset with `RESEND_API_KEY` set actually delivers an email that
      links to `APP_BASE_URL` (if email not yet configured, confirm token is
      created and reset flow still works).
- [ ] CSRF-protected forms work from the origin.

**Ingestion**
- [ ] Job ingestion endpoints accept a request with a valid `x-api-key` and
      reject a bad/missing one with `401`.

**Maintenance**
- [ ] `POST /api/internal/maintenance/run` with `x-maintenance-key` runs without
      error; wrong key → `401`.

**Resume storage (if enabled)**
- [ ] A candidate can upload/replace/delete a PDF resume and an authorized
      employer can download it; unauthorized access is rejected; uploads are
      rate-limited.

**Data**
- [ ] A fresh `npm run db:migrate` against the current schema is a no-op
      (migrations all applied, including `0004`).
- [ ] A recent PITR restore has been tested (per § Database Backup & PITR).

## The 0004 Migration Note

`0004_add_organization_verification_fields.sql` (adds `verified_at`,
`verified_by`, `verification_notes` and the `organizations_verified_by_users_id_fk`
FK) was present but missing from the migration journal. The journal has been
repaired so a fresh `db:migrate` applies it. If the deployed database was set up
before this repair and those columns are absent, run `npm run db:migrate` once
to bring it in line. A `0004_snapshot.json` was intentionally **not**
reconstructed; `db:migrate` does not read snapshots, but a future
`drizzle-kit generate` diff may report the verification columns as a "new"
change — ignore the diff for those columns (they already exist).
