# JobEthiopia

A modern Ethiopian job and career platform helping job seekers discover fresh, relevant, and trustworthy opportunities.

## Project Status

🚧 In development

## Vision

JobEthiopia aims to make it easier for Ethiopians to discover relevant job opportunities through fast search, useful filters, trustworthy vacancy information, and career resources.

## Technology

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Drizzle ORM
- Zod

## Local Setup

### Prerequisites

- Node.js 18+
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

Seed development data:

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
npm run db:push       # Push schema changes directly
npm run db:seed       # Seed development data
npm run db:studio     # Open Drizzle Studio
```

## License

License to be determined.
