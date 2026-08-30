ALTER TYPE "application_status" ADD VALUE IF NOT EXISTS 'REVIEWING';--> statement-breakpoint
ALTER TYPE "application_status" ADD VALUE IF NOT EXISTS 'SHORTLISTED';--> statement-breakpoint
ALTER TYPE "application_status" ADD VALUE IF NOT EXISTS 'REJECTED';
