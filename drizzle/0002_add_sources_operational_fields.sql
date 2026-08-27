ALTER TABLE "sources" ADD COLUMN "last_successful_check" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_attempted_check" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "check_frequency_minutes" integer;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;