CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "audit_log_target_type_id_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "job_sources_raw_hash_idx" ON "job_sources" USING btree ("raw_hash");--> statement-breakpoint
CREATE INDEX "job_sources_source_id_url_idx" ON "job_sources" USING btree ("source_id","source_url");--> statement-breakpoint
CREATE INDEX "jobs_public_newest_idx" ON "jobs" USING btree ("created_at" DESC) WHERE "jobs"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE INDEX "jobs_open_deadline_idx" ON "jobs" USING btree ("deadline") WHERE ("jobs"."status" = 'PUBLISHED' and "jobs"."deadline" IS NOT NULL);--> statement-breakpoint
CREATE INDEX "jobs_title_trgm_idx" ON "jobs" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "organizations_name_trgm_idx" ON "organizations" USING gin ("name" gin_trgm_ops);