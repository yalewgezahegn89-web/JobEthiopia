CREATE TYPE "public"."employer_onboarding_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "employer_onboarding_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_name" text NOT NULL,
	"organization_slug" text NOT NULL,
	"industry" text,
	"description" text,
	"website_url" text,
	"contact_phone" text,
	"location_id" uuid,
	"status" "employer_onboarding_request_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employer_onboarding_requests" ADD CONSTRAINT "employer_onboarding_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_onboarding_requests" ADD CONSTRAINT "employer_onboarding_requests_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employer_onboarding_requests" ADD CONSTRAINT "employer_onboarding_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employer_onboarding_requests_organization_slug_unique" ON "employer_onboarding_requests" USING btree ("organization_slug");--> statement-breakpoint
CREATE INDEX "employer_onboarding_requests_user_id_idx" ON "employer_onboarding_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "employer_onboarding_requests_status_idx" ON "employer_onboarding_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "employer_onboarding_requests_created_at_idx" ON "employer_onboarding_requests" USING btree ("created_at");
