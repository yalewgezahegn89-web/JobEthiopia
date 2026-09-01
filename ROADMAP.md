# Roadmap

Current authoritative roadmap based on the **actual** implemented state of the
product (not the original email-based plan).

## Completed — Phase 3 (B75–B99)

The candidate, employer, and staff platforms plus security and deployment
readiness:

- Authentication, password reset, candidate registration/profile/password change
- Applications, application detail, resume storage, saved jobs
- Employer onboarding, jobs/applications, team management, internal notes,
  bulk status actions
- Staff: users, organizations, job moderation, onboarding approval, taxonomy,
  audit, sources, maintenance
- Email notifications, navigation, observability, technical hardening
- CI / deployment readiness

## Deferred

Not implemented in Phase 3:

- Advanced search
- Job alerts
- Full automated ingestion
- Email verification
- Analytics
- Advertising
- AI matching
- Messaging
- Advanced career / CV tools
- Distributed rate limiting
- S3 orphan (resume) GC
- Email delivery hardening
- Mobile app / PWA
- Scale architecture

## Phase 4 Proposal (not yet started)

1. **Production launch** — provision operator config, boot admin/taxonomy,
   deploy, and run the DEPLOYMENT.md smoke tests. (Prerequisite for all else.)
2. **SEO / discoverability** — extend sitemap/structured data/OG beyond the
   current `/sitemap.xml` and `/robots.txt`.
3. **Job alerts** — candidate opt-in email alerts; reuses the existing email +
   token infrastructure.
4. **Automated ingestion** — enable the existing ingestion pipeline for
   scheduled/continuous job sourcing.
5. **Analytics** — privacy-safe product funnel/retention metrics.
6. **Career / CV tools** — CV builder, DOCX support, enhanced candidate tooling.
7. **Monetization** — employer plans/credits once a user base exists.
8. **AI matching** — match candidates to jobs once data volume justifies it.
9. **Scale** — distributed rate limiting, restaurant/source fan-out, multi-region
   resilience as adoption grows.

Phase 4 implementation has **not** begun. Items are listed for planning and are
not yet approved.
