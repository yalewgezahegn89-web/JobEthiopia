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

Seed development data (development only — never against production):

```bash
npm run db:seed
```

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
