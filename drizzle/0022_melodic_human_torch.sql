CREATE TABLE "job_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"feedback_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized_alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidate_cv_skills" ADD COLUMN "skill_id" uuid;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_skills_job_id_skill_id_unique" ON "job_skills" USING btree ("job_id","skill_id");--> statement-breakpoint
CREATE INDEX "job_skills_job_id_idx" ON "job_skills" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_skills_skill_id_idx" ON "job_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_feedback_user_id_job_id_unique" ON "recommendation_feedback" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "recommendation_feedback_user_id_idx" ON "recommendation_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendation_feedback_job_id_idx" ON "recommendation_feedback" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skill_aliases_normalized_alias_unique" ON "skill_aliases" USING btree ("normalized_alias");--> statement-breakpoint
CREATE INDEX "skill_aliases_skill_id_idx" ON "skill_aliases" USING btree ("skill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_normalized_key_unique" ON "skills" USING btree ("normalized_key");--> statement-breakpoint
CREATE INDEX "skills_category_idx" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "skills_is_active_idx" ON "skills" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "candidate_cv_skills" ADD CONSTRAINT "candidate_cv_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "candidate_cv_skills_skill_id_idx" ON "candidate_cv_skills" USING btree ("skill_id");
--> statement-breakpoint
-- Seed curated skill taxonomy for the Ethiopian job market
INSERT INTO "skills" ("id", "name", "normalized_key", "category") VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Patient Care', 'patient care', 'healthcare'),
  ('a1000000-0000-0000-0000-000000000002', 'Vital Signs Monitoring', 'vital signs monitoring', 'healthcare'),
  ('a1000000-0000-0000-0000-000000000003', 'Nutrition Assessment', 'nutrition assessment', 'healthcare'),
  ('a1000000-0000-0000-0000-000000000004', 'Health Education', 'health education', 'healthcare'),
  ('a1000000-0000-0000-0000-000000000005', 'First Aid', 'first aid', 'healthcare'),
  ('a1000000-0000-0000-0000-000000000006', 'Financial Analysis', 'financial analysis', 'finance'),
  ('a1000000-0000-0000-0000-000000000007', 'Budgeting', 'budgeting', 'finance'),
  ('a1000000-0000-0000-0000-000000000008', 'Accounting', 'accounting', 'finance'),
  ('a1000000-0000-0000-0000-000000000009', 'Tax Compliance', 'tax compliance', 'finance'),
  ('a1000000-0000-0000-0000-000000000010', 'Financial Reporting', 'financial reporting', 'finance'),
  ('a1000000-0000-0000-0000-000000000011', 'Supply Chain Management', 'supply chain management', 'operations'),
  ('a1000000-0000-0000-0000-000000000012', 'Inventory Management', 'inventory management', 'operations'),
  ('a1000000-0000-0000-0000-000000000013', 'Procurement', 'procurement', 'operations'),
  ('a1000000-0000-0000-0000-000000000014', 'Logistics', 'logistics', 'operations'),
  ('a1000000-0000-0000-0000-000000000015', 'Microsoft Office', 'microsoft office', 'general'),
  ('a1000000-0000-0000-0000-000000000016', 'Data Entry', 'data entry', 'general'),
  ('a1000000-0000-0000-0000-000000000017', 'Customer Service', 'customer service', 'general'),
  ('a1000000-0000-0000-0000-000000000018', 'Communication Skills', 'communication skills', 'general'),
  ('a1000000-0000-0000-0000-000000000019', 'Team Leadership', 'team leadership', 'general'),
  ('a1000000-0000-0000-0000-000000000020', 'Time Management', 'time management', 'general'),
  ('a1000000-0000-0000-0000-000000000021', 'Computer Literacy', 'computer literacy', 'general'),
  ('a1000000-0000-0000-0000-000000000022', 'Vehicle Maintenance', 'vehicle maintenance', 'transport'),
  ('a1000000-0000-0000-0000-000000000023', 'Safe Driving', 'safe driving', 'transport')
ON CONFLICT ("normalized_key") DO NOTHING;
--> statement-breakpoint
-- Seed common aliases
INSERT INTO "skill_aliases" ("skill_id", "alias", "normalized_alias") VALUES
  ('a1000000-0000-0000-0000-000000000015', 'MS Office', 'ms office'),
  ('a1000000-0000-0000-0000-000000000015', 'Office Suite', 'office suite'),
  ('a1000000-0000-0000-0000-000000000017', 'Customer Support', 'customer support'),
  ('a1000000-0000-0000-0000-000000000017', 'Client Relations', 'client relations'),
  ('a1000000-0000-0000-0000-000000000018', 'Communication', 'communication'),
  ('a1000000-0000-0000-0000-000000000018', 'Interpersonal Skills', 'interpersonal skills'),
  ('a1000000-0000-0000-0000-000000000019', 'Leadership', 'leadership'),
  ('a1000000-0000-0000-0000-000000000019', 'Team Management', 'team management'),
  ('a1000000-0000-0000-0000-000000000011', 'Supply Chain', 'supply chain'),
  ('a1000000-0000-0000-0000-000000000008', 'Bookkeeping', 'bookkeeping'),
  ('a1000000-0000-0000-0000-000000000006', 'Financial Modelling', 'financial modelling'),
  ('a1000000-0000-0000-0000-000000000016', 'Typing', 'typing')
ON CONFLICT ("normalized_alias") DO NOTHING;