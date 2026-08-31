CREATE TABLE "candidate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"phone" text,
	"location_id" uuid,
	"professional_summary" text,
	"total_experience_years" integer,
	"education" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "candidate_profiles_total_experience_years_non_negative" CHECK ("candidate_profiles"."total_experience_years" IS NULL OR "candidate_profiles"."total_experience_years" >= 0),
	CONSTRAINT "candidate_profiles_total_experience_years_max" CHECK ("candidate_profiles"."total_experience_years" IS NULL OR "candidate_profiles"."total_experience_years" <= 60)
);
--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_profiles_candidate_id_unique" ON "candidate_profiles" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "candidate_profiles_location_id_idx" ON "candidate_profiles" USING btree ("location_id");
