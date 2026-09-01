# Changelog

All notable changes are tracked by phase and batch.

## Phase 3 — Platform & Security Release (B75–B99)

The first formal release baseline. Functional scope for the candidate, employer,
and staff platforms is complete and tested.

### Implemented

- **Authentication / password reset** — scrypt password hashing, email reset via
  Resend (or in-app token flow when email is unconfigured), anti-enumeration.
- **Candidate registration / profile / password change** — registration flow,
  candidate profile, password change with atomic session revocation + audit.
- **Applications / application detail** — submission, candidate detail view,
  status tracking.
- **Resume storage** — private S3/R2 object storage served through a server-side
  proxy; PDF-only, size-limited, ownership/tenant enforced.
- **Saved jobs** — save and browse saved jobs per candidate.
- **Employer onboarding** — request → staff approval, dashboard.
- **Employer jobs / applications** — job CRUD + moderation, application review.
- **Employer team management** — organization membership management.
- **Internal notes** — per-application notes for authorized reviewers.
- **Bulk status actions** — bulk application status change with capped email fan-out.
- **Email notifications** — submission confirmation, status-change, and password-reset
  emails via Resend; graceful no-op when unconfigured.
- **Navigation** — protected route guards for admin/organization areas.
- **Observability** — structured JSON logs, request correlation IDs, redaction.
- **Technical hardening** — CSRF, SSRF, rate limiting, nonce CSP, security headers,
  secure cookies, DB connection pool + TLS defaults.
- **CI / deployment readiness** — CI workflow, healthy build with CI-provided
  `APP_BASE_URL`, deployment guide and smoke-test checklist.

### Deferred (out of Phase 3 scope)

- Advanced search
- Job alerts
- Full automated ingestion
- Email verification
- DOC/DOCX resumes (PDF-only currently)
- AI matching
- Messaging
- Analytics / advertising
- Distributed rate limiting (in-process store today)
- S3 orphan / resume GC
- Email delivery hardening (retry queue / delivery status)
- Mobile app / PWA
- Large-scale ingestion / scale architecture

### Production-configuration-required (not code)

- `DATABASE_URL`, real `APP_BASE_URL`, backups/PITR
- Taxonomy provisioning and first `SUPER_ADMIN` bootstrap
- Resend (`RESEND_API_KEY`, `EMAIL_FROM`) and S3/R2 (`RESUME_STORAGE_*`)
- HTTPS / HSTS / Permissions-Policy at the edge
- Trusted-client-IP header, maintenance cron, monitoring

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the operator runbook and launch checklist.

---

## Phase 2 — Ingestion & Public Discovery (pre-B75)

Prior phases established the database foundation, the job-source ingestion
pipeline (fetching, normalization, deduplication, health checks), taxonomy,
and the public job/career discovery experience.
