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
| `INTERNAL_INGESTION_API_KEY` | Route-dedicated key for the internal ingestion endpoint (sent as `x-maintenance-key`). Falls back to `MAINTENANCE_API_KEY` when unset. | No | Yes |
| `INTERNAL_JOB_ALERTS_API_KEY` | Route-dedicated key for the internal job-alert digest endpoint (sent as `x-maintenance-key`). Falls back to `MAINTENANCE_API_KEY` when unset. | No | Yes |

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
  and (Phase 7 Batch 12) the **Strict-Transport-Security (HSTS)** header via
  `next.config.ts`. The reverse proxy / TLS terminator / CDN must enforce the
  actual **HTTPS redirect** (HTTP→HTTPS); **Permissions-Policy** is also an
  edge responsibility. If you terminate TLS at the edge, ensure an HTTP→HTTPS
  redirect and that the edge does not strip the app-emitted headers.
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

Three unauthenticated, GET-only endpoints differentiate liveness from
readiness. All responses contain no database internals and no error details:

| Endpoint | Question | Response |
|---|---|---|
| `GET /api/health/live` | Is the process capable of responding? | `200 {"status":"ok"}` — no dependency is touched |
| `GET /api/health/ready` | Can the app serve database-dependent traffic? | `200 {"status":"ok"}` when the DB answers `SELECT 1` within 3s; otherwise `503 {"status":"error"}` |
| `GET /api/health` | Backwards-compatible readiness alias (same as `/ready`) | `200 {"status":"ok"}` / `503 {"status":"error"}` |

Use `/live` for process/instance liveness probes and `/ready` (or `/health`)
for uptime/readiness monitoring. A readiness failure is the deployment's
"do not route traffic here" signal; it is safe to hit when the database is
unavailable.

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

- Authenticated by the `x-maintenance-key` header (configured as
  `MAINTENANCE_API_KEY`); returns `401` on a missing/mismatched key. See
  [Internal automation endpoints](#internal-automation-endpoints) for optional
  per-route keys.
- **Not idempotent-safe to run concurrently — schedule a single instance**
  (e.g. once daily, cron `0 3 * * *` UTC) and avoid overlapping runs. A run
  already in progress guard is **not** enforced, so do not overlap it.
- In a serverless/scale-to-zero deployment, a cron schedule may cold-start the
  function or the run may be short-lived; prefer a time window with a retry and
  confirm the run completes in the logs.
- Requires `MAINTENANCE_API_KEY` at **deploy/runtime** time (not just build).

### Automated scheduling (GitHub Actions)

Production maintenance is automated via
[`.github/workflows/maintenance.yml`](./.github/workflows/maintenance.yml).

**Repository configuration** (Settings → Secrets and variables → Actions):

- **Secret** — `MAINTENANCE_API_KEY`: the maintenance API key. It must match
  the `MAINTENANCE_API_KEY` configured in the production environment. Never set
  in code.
- **Variable** — `MAINTENANCE_TARGET_URL`: the production HTTPS origin only
  (e.g. `https://jobs.example.com`), without the maintenance path. The workflow
  appends `/api/internal/maintenance/run` to it.

**Schedule:** `0 3 * * *` — `03:00 UTC` daily.

**Important:** GitHub scheduled workflows run from the repository's **default
branch**. The workflow must therefore be merged into `main` before scheduled
execution becomes active. Until then, it can still be run on demand (below).

**Manual execution:** the workflow is also triggerable on demand via
`workflow_dispatch` (Actions → "Run workflow", or `gh workflow run
Maintenance`).

**Expected successful response:**

```json
{
  "expiredJobs": 0,
  "sourcesChecked": 0,
  "sourcesSucceeded": 0,
  "sourcesFailed": 0,
  "sourcesSkipped": 0
}
```

**Failure behavior:**

- Wrong or missing API key → `401`, workflow fails.
- Bad target URL → workflow fails.
- Server `5xx` → the workflow retries (`--retry-on-http-error` for
  `429,500,502,503,504`), then fails if still unsuccessful.
- Public users remain protected by Phase 5A even if maintenance fails:
  past-deadline and stale jobs are already hidden in real time by the public
  API.

**Concurrency:** only one production maintenance run at a time
(`concurrency: group maintenance-production`, `cancel-in-progress: false`).

**Operational smoke test:** run the workflow manually (via `workflow_dispatch`)
after every production deployment to confirm the endpoint answers with the JSON
summary.

## Internal Automation Endpoints

Three cron-driven internal endpoints share one authentication contract and must
never be publicly reachable (they are POST-only and rate-limited):

| Endpoint | Workflow | Schedule (UTC) |
|---|---|---|
| `POST /api/internal/maintenance/run` | [`.github/workflows/maintenance.yml`](./.github/workflows/maintenance.yml) | `0 3 * * *` — daily 03:00 |
| `POST /api/internal/ingestion/run` | [`.github/workflows/ingestion.yml`](./.github/workflows/ingestion.yml) | `30 3 * * *` — daily 03:30 (after maintenance) |
| `POST /api/internal/job-alerts/daily` | [`.github/workflows/job-alerts.yml`](./.github/workflows/job-alerts.yml) | `0 4 * * *` — daily 04:00 (after ingestion) |

`POST /api/internal/ingestion/dry-run?sourceId=<id>` is the on-demand (non-cron)
sibling of the ingestion endpoint: it fetches a single source, validates and
normalizes each item, and runs the read-only dedup cascade **without writing any
rows** — it is the operator preview to run before enabling a new source.

**Authentication:** all three cron endpoints (and the dry-run sibling) verify the
`x-maintenance-key` header in constant time. Key resolution is rollout-safe:

1. Route-dedicated key when configured —
   `INTERNAL_INGESTION_API_KEY` (ingestion), `INTERNAL_JOB_ALERTS_API_KEY`
   (job alerts), or `MAINTENANCE_API_KEY` (maintenance).
2. Otherwise the shared `MAINTENANCE_API_KEY` fallback.

Until the dedicated keys are set in an environment, every route accepts
`MAINTENANCE_API_KEY` exactly as it did before. To adopt per-route keys, set the
dedicated secret in both the deploy environment and the GitHub workflow secret,
keeping the shared key as a temporary fallback until the rotate-by-route is
complete.

**Failure behavior (all workflows):** any non-2xx (401/500/…) fails the workflow
step. Retries (`429,500,502,503,504`, 3 attempts, 30s apart) apply to
maintenance and ingestion (idempotent, dedup- and claim-guarded); the job-alerts
digest does NOT retry because it sends email — the claim-before-send guard means
a later manual rerun is safe. A malformed 2xx body and a network/timeout failure
also fail the job so a missed run is never silently swallowed. All workflows use
`concurrency` groups so runs never overlap.

**Manual rerun:** each workflow is triggerable on demand via `workflow_dispatch`
(Actions → "Run workflow"). Ingestion additionally supports
`POST /api/internal/ingestion/run?sourceId=<id>` to run a single source, and
`POST /api/internal/ingestion/dry-run?sourceId=<id>` to preview a source
read-only before enabling it.

## Ingestion (Automated Core)

Production ingestion is scheduled by
[`.github/workflows/ingestion.yml`](./.github/workflows/ingestion.yml) at
`03:30 UTC` daily. It invokes `POST /api/internal/ingestion/run`, which sweeps
sources whose `check_frequency_minutes` interval is due, applies the four-level
dedup ladder, auto-creates entities and locations, and publishes only through
the moderation-first gate. The sweep is bounded to the source types with an
adapter (`API`/`FEED`); manual/website/employer sources are never polled. Jobs
that are already published are never silently rewritten by automated ingestion —
their content stays as the moderator approved it (see `updateJob`).

- **Repository configuration** — interval/git: **Secret** `MAINTENANCE_API_KEY`
  (and optionally `INTERNAL_INGESTION_API_KEY`); **Variable**
  `MAINTENANCE_TARGET_URL`.
- **Concurrency:** `group: ingestion-production`,
  `cancel-in-progress: false` (one run at a time).
- **Expected success:** the endpoint returns
  `{"checked":n,"succeeded":n,"failed":n,"skipped":n}`.
- **Manual single-source run:** `POST /api/internal/ingestion/run?sourceId=<uuid>`
  with the same `x-maintenance-key` header.

## Job Alerts (Daily Digest)

Production digest dispatch is scheduled by
[`.github/workflows/job-alerts.yml`](./.github/workflows/job-alerts.yml) at
`04:00 UTC` daily (after ingestion so the digest includes that morning's new
jobs). It invokes `POST /api/internal/job-alerts/daily`, which sweeps
ACTIVE/DAILY alerts, matches eligible public jobs via the shared eligibility
helper, collects matching job IDs, and claims each alert before sending to make
concurrent/repeated runs safe.

- **Repository configuration** — **Secret** `MAINTENANCE_API_KEY` (and
  optionally `INTERNAL_JOB_ALERTS_API_KEY`); **Variable**
  `MAINTENANCE_TARGET_URL`.
- **Email:** requires `RESEND_API_KEY`/`EMAIL_FROM` in the deployment
  environment (see [Password Reset / Email](#password-reset--email)); without
  them the digest runs and reports `emailsSent: 0` (noop transport).
- **Expected success:** the endpoint returns
  `{"alertsProcessed":n,"sent":n,"skippedNoEmail":n,"failed":n,...}`.

## Operations Requirements

Pre-launch operator actions that are **not** code changes:

- **Rotate the staging database credential.** A local `/.env.staging.txt`
  containing a staging `DATABASE_URL` once existed in the working tree (Phase 8
  Batch 1 removed it). In the platform where that credential was configured,
  **rotate the password** so the old value is dead. Never store real
  credentials in repository files; `.env*` files are git-ignored and
  `/.env.staging.txt` is explicitly blocked.
- **Configure a real email provider.** Production requires `RESEND_API_KEY` and
  `EMAIL_FROM` from a verified domain, otherwise password-reset and
  application/alerts emails silently no-op.
- **Enable PITR and test a restore** before go-live (§ Database Backup & PITR).
- **Error tracking / monitoring.** The application logs structured JSON to
  stdout/stderr with `x-request-id` correlation. Configure platform log
  capture, an alert on `level:"error"` events (e.g. `*_failed` events from the
  internal endpoints), and uptime checks on `/api/health` and
  `/api/health/ready`. A pluggable error service (Sentry/OTel) is a deliberate
  Phase 8 deferral; `src/lib/observability/errors.ts` is the single seam.
- **Cron alerting.** Workflows now fail loudly on any non-2xx/network error;
  configure GitHub notifications (default branch) so a failed run pages the
  operator.

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
- [ ] `GET /api/health/live` returns `200 {"status":"ok"}` without touching the
      database; `GET /api/health/ready` returns `200` when the DB is reachable
      and `503 {"status":"error"}` during a DB-down drill.
- [ ] `APP_BASE_URL` is the real HTTPS origin and resolves; `/sitemap.xml` and
      `/robots.txt` use it (no `localhost`); page `metadata` canonical URLs use it.
- [ ] HTTPS enforced at the edge (HTTP→HTTPS redirect), HSTS + Permissions-Policy
      present (HSTS is emitted by the app via `next.config.ts`; the HTTP→HTTPS
      redirect and Permissions-Policy are edge responsibilities), and app-emitted
      CSP / X-Content-Type-Options / X-Frame-Options / Referrer-Policy / HSTS
      headers present on responses.
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
- [ ] `POST /api/internal/ingestion/run` with a valid `x-maintenance-key` returns
      the JSON summary; wrong key → `401`.
- [ ] `POST /api/internal/ingestion/dry-run?sourceId=<uuid>` with a valid
      `x-maintenance-key` returns the read-only item analysis and writes nothing
      (verify via an unchanged source-count/`job_sources` in staging);
      missing/invalid `sourceId` → `400`.

**Job alerts**
- [ ] `POST /api/internal/job-alerts/daily` with a valid `x-maintenance-key`
      returns the digest summary (no-op email counts allowed when email is
      unconfigured); wrong key → `401`.

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
