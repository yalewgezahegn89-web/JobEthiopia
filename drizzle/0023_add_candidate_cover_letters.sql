CREATE TABLE "candidate_cover_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid,
	"title" text NOT NULL,
	"position" text NOT NULL,
	"employer" text NOT NULL,
	"recipient" text,
	"location" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cover_letters" ADD CONSTRAINT "candidate_cover_letters_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_cover_letters" ADD CONSTRAINT "candidate_cover_letters_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_cover_letters_candidate_updated_idx" ON "candidate_cover_letters" USING btree ("candidate_id","updated_at");--> statement-breakpoint
CREATE INDEX "candidate_cover_letters_job_id_idx" ON "candidate_cover_letters" USING btree ("job_id");