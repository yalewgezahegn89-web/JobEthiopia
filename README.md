# JobEthiopia

A modern Ethiopian job and career platform helping job seekers discover fresh, relevant, and trustworthy opportunities — and helping employers find and manage candidates.

## Project Status

**Phase 3 complete (implementation baseline).** The candidate, employer, and staff platforms are implemented, tested, and production-ready at the code level. Live production deployment remains an **operator task** (see [DEPLOYMENT.md](./DEPLOYMENT.md)) — no production instance, real users, live email, or configured storage are claimed yet.

## Platforms

### Candidate
- Registration, login, logout
- Profile and password change (with session revocation + audit)
- Password reset (email via Resend when configured; otherwise in-app token flow)
- Search and browse jobs by category, profession, location, and organization
- Save jobs
- Apply to jobs, view application details
- Upload/replace/delete a PDF resume (private S3/R2 storage)
- Application submission and status-change email notifications

### Employer
- Onboarding request → staff approval
- Dashboard
- Job creation/editing/closing and moderation workflow
- Application review with internal notes
- Team/membership management
- Bulk application status actions

### Staff / Admin
- User, organization, and job moderation
- Employer-onboarding approval
- Taxonomy management (categories, locations, professions)
- Job-source management and health checks
- Audit log and maintenance endpoint

## Technology

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- Zod

## Local Setup

### Prerequisites

- Node.js 18+ (20 LTS recommended)
- PostgreSQL

### Installation

```bash
npm install
```

### Environment Configuration

Copy the example environment file and configure your database connection:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your PostgreSQL connection string:

```
DATABASE_URL="postgresql://user:password@localhost:5432/jobethiopia"
```

### Database Setup

Run migrations:

```bash
npm run db:migrate
```

Seed development data (guarded — never against an unvalidated target):

```bash
npm run db:seed
```

`db:seed` is protected by an environment-and-database-target guard and fails closed for unsafe targets. Configure these variables in your local (uncommitted) environment before seeding:

- `DATABASE_URL` — PostgreSQL connection URL for the intended seed target (credentials must never be committed).
- `SEED_PRODUCTION_DATABASE_HOST` — exact hostname of the Production database (placeholder: `<production-db-host>`). Required so non-production runs can be proven not to target Production.
- `SEED_ALLOWED_DATABASE_HOSTS` — comma-separated exact hostnames approved for non-production seeding (placeholder: `<preview-db-host>,<staging-db-host>`). Required for remote non-production targets.
- `SEED_ALLOW_PRODUCTION` — Production seeding only: must be the exact value `CONFIRM_PRODUCTION_SEED` **and** `DATABASE_URL` must target `SEED_PRODUCTION_DATABASE_HOST`.

A Preview/local environment is never safe just because of `VERCEL_ENV`; the target host is independently validated (Preview/remote must be allowlisted and must not equal the Production host). Local loopback PostgreSQL targets (`localhost`, `127.0.0.1`, `::1`) are allowed for local development. Never point Preview at Production. Do not run seeds against a production database.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database Commands

```bash
npm run db:generate   # Generate migration files
npm run db:migrate    # Run pending migrations
npm run db:push       # Push schema changes directly (do not use in production)
npm run db:seed       # Seed development data
npm run db:studio     # Open Drizzle Studio
```

## Deployment

Production deployment and configuration are **operator tasks**. See [DEPLOYMENT.md](./DEPLOYMENT.md) for environment variables, migration, bootstrap (first SUPER_ADMIN), backups/PITR, email, resume storage, maintenance cron, and the launch smoke-test checklist.

## License

License to be determined.
