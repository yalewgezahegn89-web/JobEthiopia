CREATE TYPE "public"."alert_delivery_status" AS ENUM('SENT', 'SKIPPED_NO_EMAIL', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."alert_frequency" AS ENUM('INSTANT', 'DAILY');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('ACTIVE', 'PAUSED', 'UNSUBSCRIBED', 'DISABLED');--> statement-breakpoint
CREATE TABLE "job_alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "alert_delivery_status" DEFAULT 'SENT' NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"keywords" text,
	"category_id" uuid,
	"profession_id" uuid,
	"location_id" uuid,
	"employment_type" "employment_type",
	"frequency" "alert_frequency" DEFAULT 'DAILY' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"status" "alert_status" DEFAULT 'ACTIVE' NOT NULL,
	"unsubscribe_token_hash" text,
	"unsubscribe_token_expires_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_alert_deliveries" ADD CONSTRAINT "job_alert_deliveries_alert_id_job_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."job_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_alert_deliveries" ADD CONSTRAINT "job_alert_deliveries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_alerts" ADD CONSTRAINT "job_alerts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_alert_deliveries_alert_id_job_id_unique" ON "job_alert_deliveries" USING btree ("alert_id","job_id");--> statement-breakpoint
CREATE INDEX "job_alert_deliveries_alert_id_idx" ON "job_alert_deliveries" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "job_alert_deliveries_job_id_idx" ON "job_alert_deliveries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_alerts_user_id_idx" ON "job_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_alerts_status_frequency_idx" ON "job_alerts" USING btree ("status","frequency");--> statement-breakpoint
CREATE INDEX "job_alerts_last_sent_at_idx" ON "job_alerts" USING btree ("last_sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_alerts_unsubscribe_token_hash_unique" ON "job_alerts" USING btree ("unsubscribe_token_hash");