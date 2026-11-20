CREATE TYPE "public"."applicant_eligibility" AS ENUM('ETHIOPIAN_APPLICANTS_CONFIRMED', 'INTERNATIONAL_APPLICANTS_ACCEPTED', 'LOCAL_WORK_AUTHORIZATION_REQUIRED', 'CITIZENSHIP_RESTRICTED', 'NOT_STATED');--> statement-breakpoint
CREATE TYPE "public"."telegram_publication_state" AS ENUM('QUEUED', 'SENDING', 'RETRY', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "telegram_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"state" "telegram_publication_state" DEFAULT 'QUEUED' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"telegram_message_id" text,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_publications_attempts_non_negative" CHECK ("telegram_publications"."attempts" >= 0),
	CONSTRAINT "telegram_publications_max_attempts_positive" CHECK ("telegram_publications"."max_attempts" > 0)
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "applicant_eligibility" "applicant_eligibility" DEFAULT 'NOT_STATED' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "auto_publish" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_publications" ADD CONSTRAINT "telegram_publications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_publications_job_channel_unique" ON "telegram_publications" USING btree ("job_id","channel");--> statement-breakpoint
CREATE INDEX "telegram_publications_state_next_retry_idx" ON "telegram_publications" USING btree ("state","next_retry_at");