CREATE TYPE "public"."facebook_publication_state" AS ENUM('PENDING', 'PUBLISHED', 'FAILED', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "facebook_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"page_id" text NOT NULL,
	"state" "facebook_publication_state" DEFAULT 'PENDING' NOT NULL,
	"facebook_post_id" text,
	"requested_by" uuid,
	"last_error" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "facebook_publications" ADD CONSTRAINT "facebook_publications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facebook_publications" ADD CONSTRAINT "facebook_publications_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "facebook_publications_job_page_unique" ON "facebook_publications" USING btree ("job_id","page_id");--> statement-breakpoint
CREATE INDEX "facebook_publications_state_idx" ON "facebook_publications" USING btree ("state");