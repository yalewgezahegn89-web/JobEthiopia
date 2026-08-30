CREATE TYPE "public"."application_status" AS ENUM('SUBMITTED', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"candidate_user_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'SUBMITTED' NOT NULL,
	"cover_letter" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidate_user_id_users_id_fk" FOREIGN KEY ("candidate_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "applications_job_id_candidate_user_id_unique" ON "applications" USING btree ("job_id","candidate_user_id");--> statement-breakpoint
CREATE INDEX "applications_candidate_user_id_created_at_idx" ON "applications" USING btree ("candidate_user_id","created_at");--> statement-breakpoint
CREATE INDEX "applications_job_id_status_idx" ON "applications" USING btree ("job_id","status");