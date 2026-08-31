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

- `APP_BASE_URL` must be the real production origin (e.g. `https://jobs.example.com`).
- HTTPS should be used in production. Secure session cookies depend on `NODE_ENV=production`.
- API keys must be stored in the hosting platform's secret/env system, never in code.
- `TRUSTED_CLIENT_IP_HEADER` should only be configured when the proxy sanitizes/overwrites that header.

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

## First Admin Bootstrap

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
