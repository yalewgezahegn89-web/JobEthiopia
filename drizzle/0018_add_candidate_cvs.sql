CREATE TABLE "candidate_cvs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"title" text NOT NULL,
	"professional_summary" text,
	"phone" text,
	"location" text,
	"website_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cvs" ADD CONSTRAINT "candidate_cvs_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_cvs_candidate_id_unique" ON "candidate_cvs" USING btree ("candidate_id");--> statement-breakpoint
CREATE TABLE "candidate_cv_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_id" uuid NOT NULL,
	"employer" text NOT NULL,
	"role" text NOT NULL,
	"location" text,
	"start_month" text NOT NULL,
	"end_month" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cv_experiences" ADD CONSTRAINT "candidate_cv_experiences_cv_id_candidate_cvs_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."candidate_cvs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_cv_experiences_cv_id_idx" ON "candidate_cv_experiences" USING btree ("cv_id");--> statement-breakpoint
CREATE TABLE "candidate_cv_educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_id" uuid NOT NULL,
	"institution" text NOT NULL,
	"qualification" text NOT NULL,
	"field_of_study" text,
	"start_month" text NOT NULL,
	"end_month" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cv_educations" ADD CONSTRAINT "candidate_cv_educations_cv_id_candidate_cvs_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."candidate_cvs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_cv_educations_cv_id_idx" ON "candidate_cv_educations" USING btree ("cv_id");--> statement-breakpoint
CREATE TABLE "candidate_cv_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cv_skills" ADD CONSTRAINT "candidate_cv_skills_cv_id_candidate_cvs_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."candidate_cvs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_cv_skills_cv_id_idx" ON "candidate_cv_skills" USING btree ("cv_id");--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_cv_skills_cv_id_name_unique" ON "candidate_cv_skills" USING btree ("cv_id","name");--> statement-breakpoint
CREATE TABLE "candidate_cv_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_id" uuid NOT NULL,
	"name" text NOT NULL,
	"issuer" text NOT NULL,
	"issued_month" text NOT NULL,
	"credential_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cv_certifications" ADD CONSTRAINT "candidate_cv_certifications_cv_id_candidate_cvs_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."candidate_cvs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_cv_certifications_cv_id_idx" ON "candidate_cv_certifications" USING btree ("cv_id");
