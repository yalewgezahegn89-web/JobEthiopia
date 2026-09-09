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

## Deferred (resolved by Phase 7)

The following items, originally deferred from Phase 3 and proposed under
a prior Phase 4 draft, are now formally absorbed into Phase 7.

---

## Phase 7 — Production Launch, Discoverability, Localization & User-Growth

> "Production launch, discoverability, localization, and user-growth
> foundations for JobEthiopia."

Phase 7 begins from the clean Phase 6 release (`9a30db1`) plus the Phase 7
Batch 1 technical baseline repair (`d232691`).

### Supported Interface Languages

JobEthiopia will initially support three interface languages:

1. **English** — locale `en` (fallback/default language)
2. **Amharic** — locale `am` · display name: **አማርኛ**
3. **Afaan Oromoo** — locale `om` · display name: **Afaan Oromoo**

Additional languages are outside the current Phase 7 scope.

Vacancy content is Unicode-safe and is **not** automatically translated merely
because a user changes interface language.

### Ordered Batches

#### Batch 1 — Baseline Repair (COMPLETED)

Commit: `chore(phase7): repair baseline type safety` (`d232691`)

- Repair pre-existing TypeScript errors (`tsc` exit 0)
- Preserve 179/3312 green baseline
- No product implementation

#### Batch 2 — Phase 7 Specification (COMPLETED)

- Formalize Phase 7 scope in ROADMAP.md
- Record Phase 7 history in CHANGELOG.md
- No product implementation

#### Batch 3 — Production Launch Readiness

Scope:

- production environment configuration
- production database readiness
- production source provisioning
- organization/taxonomy provisioning
- admin bootstrap
- deployment smoke tests
- maintenance scheduler verification
- production security configuration
- production launch checklist

Non-goals: new product features, broad UI redesign, localization
implementation.

Acceptance: production configuration explicitly verified, smoke tests pass,
no secrets committed, launch checklist complete.

#### Batch 4 — SEO / Discoverability

Scope:

- metadata consistency
- sitemap completeness
- robots configuration
- canonical URLs
- OpenGraph / Twitter metadata
- structured data where useful
- indexability verification
- job detail discoverability
- organization / category / location landing-page discoverability

Preserve existing public visibility safeguards.

Acceptance: all intended public job pages discoverable, stale/expired/
ineligible jobs remain excluded, metadata valid, sitemap contains only
appropriate public content, no private/admin pages become indexable.

#### Batch 5 — Localization / Ethiopian Language Support

**This is a first-class Phase 7 requirement.**

Localization objectives:

- A. Build a maintainable localization architecture.
- B. Keep English as the fallback/default language.
- C. Add complete Amharic (አማርኛ) UI translation for the agreed MVP surface.
- D. Add complete Afaan Oromoo UI translation for the same MVP surface.
- E. Ensure language switching persists appropriately.
- F. Ensure navigation, buttons, labels, validation messages, auth UI,
  job-search UI, job-detail UI, employer UI, and key system messages can
  render in all three supported languages.
- G. Keep RTL assumptions out — Amharic and Afaan Oromoo use left-to-right
  presentation.
- H. Preserve Unicode/Ethiopic text exactly.
- I. Do not transliterate Amharic into Latin characters.
- J. Do not rewrite employer/job content merely because the UI language
  changes.
- K. Job titles/descriptions must remain Unicode-safe and may contain English,
  Amharic, Afaan Oromoo, or mixed-language content.
- L. Localized URL strategy must be deliberate and documented before
  implementation.
- M. SEO localized metadata should be considered part of the localization
  architecture, not an accidental later addition.
- N. Missing translation keys must fall back safely to English rather than
  rendering blank UI.

Localization non-goals:

- machine-translating every existing database record
- automatic translation of employer vacancy content
- AI translation
- more than the three supported interface languages
- full multilingual job-content authoring workflow in this batch
- changing database character encoding
- rewriting existing Unicode validation

Acceptance: English fully functional, Amharic interface renders correctly,
Afaan Oromoo interface renders correctly, no missing-key blank UI on core
surfaces, Ethiopic characters render correctly, form validation works in all
supported UI languages, job content remains unchanged when language switches,
language preference survives navigation/reload according to chosen design,
no public/private visibility regression, accessibility labels have
translated equivalents where user-facing.

#### Batch 6 — Job Alerts

Scope: opt-in job alerts, alert preferences, secure unsubscribe, email
delivery, frequency controls, matching based on job criteria, notification
auditability.

Dependencies: production email configuration, localization foundation.

#### Batch 7 — Automated Ingestion

Scope: scheduled source checks, source health, ingestion automation,
controlled deduplication, failure/retry handling.

Preserve Phase 5 data-quality rules.

#### Batch 8 — Analytics

Scope: search/job engagement metrics, admin operational metrics,
privacy-conscious analytics, performance dashboards.

#### Batch 9 — Career / CV Tools

Scope: CV/resume tooling, career profiles, document support, relevant
candidate workflows.

#### Batch 10 — Monetization

Scope: advertising/revenue foundations, employer monetization where approved,
billing/payment integration if approved.

#### Batch 11 — AI Matching

Scope: candidate/job matching, recommendations, relevance scoring,
explainability and safety.

Must not bypass existing job publication, provenance, or eligibility rules.

#### Batch 12 — Scale / Hardening

Scope: distributed rate limiting, background processing, queues/retries,
storage lifecycle cleanup, performance/indexing based on measured evidence,
resilience and observability.

### Phase 7 Global Non-Goals

- no schema redesign without evidence
- no premature fuzzy matching
- no automatic duplicate deletion
- no weakening Phase 5/6 publication gates
- no public exposure of private provenance fields
- no credential handling inside source code
- no silent production data mutation
- no uncontrolled scraping
- no automatic translation of third-party vacancy content
- no extra localization languages beyond en/am/om without approval
- no AI matching before its dedicated batch
- no broad UI redesign unless required by the scoped batch

### Phase 7 Dependency Rule

Every batch must:

- start from a clean committed checkpoint
- have a written audit/report
- preserve previous phase behavior
- avoid unrelated refactors
- run targeted tests
- run the full test suite when practical
- verify lint/typecheck
- explicitly identify any staging/production side effects

No batch should silently absorb work from another batch.

### Phase 7 Acceptance Criteria

Phase 7 as a whole is complete only when:

1. production launch prerequisites are verified
2. public discoverability is technically sound
3. English + Amharic (አማርኛ) + Afaan Oromoo interface support is
   implemented
4. job alerts are functional
5. automated ingestion is controlled and observable
6. analytics are operational
7. career/CV foundations are delivered
8. monetization foundations are delivered
9. AI matching is delivered safely
10. scale/hardening requirements are addressed
11. no CRITICAL/HIGH unresolved security findings
12. final tests/typecheck/lint pass
13. final production-readiness audit is GREEN
14. final Phase 7 release checkpoint is committed and pushed
