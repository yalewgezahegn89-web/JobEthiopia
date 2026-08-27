ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_locations_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salary_min_non_negative" CHECK ("jobs"."salary_min" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salary_max_non_negative" CHECK ("jobs"."salary_max" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_experience_min_non_negative" CHECK ("jobs"."experience_min" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_experience_max_non_negative" CHECK ("jobs"."experience_max" >= 0);--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_salary_max_gte_min" CHECK ("jobs"."salary_min" IS NULL OR "jobs"."salary_max" IS NULL OR "jobs"."salary_max" >= "jobs"."salary_min");--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_experience_max_gte_min" CHECK ("jobs"."experience_min" IS NULL OR "jobs"."experience_max" IS NULL OR "jobs"."experience_max" >= "jobs"."experience_min");