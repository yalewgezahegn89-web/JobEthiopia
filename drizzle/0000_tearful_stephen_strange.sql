CREATE TYPE "public"."article_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP', 'VOLUNTEER', 'FREELANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'EXPIRED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('COUNTRY', 'REGION', 'CITY', 'DISTRICT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('HOURLY', 'DAILY', 'MONTHLY', 'YEARLY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('MANUAL', 'WEBSITE', 'API', 'FEED', 'EMPLOYER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'VERIFIED', 'NEEDS_REVIEW', 'INVALID');--> statement-breakpoint
CREATE TABLE "career_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"excerpt" text,
	"content" text NOT NULL,
	"category" text,
	"status" "article_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"external_id" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"raw_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_sources_source_external_id_unique" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"category_id" uuid,
	"profession_id" uuid,
	"location_id" uuid,
	"description" text NOT NULL,
	"responsibilities" text,
	"requirements" text,
	"education_requirements" text,
	"benefits" text,
	"experience_min" integer,
	"experience_max" integer,
	"employment_type" "employment_type",
	"salary_min" numeric,
	"salary_max" numeric,
	"salary_currency" text,
	"salary_period" "salary_period",
	"posted_at" timestamp with time zone,
	"deadline" timestamp with time zone,
	"application_url" text,
	"status" "job_status" DEFAULT 'DRAFT' NOT NULL,
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "location_type" NOT NULL,
	"parent_id" uuid,
	"latitude" numeric,
	"longitude" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"industry" text,
	"website_url" text,
	"logo_url" text,
	"location_id" uuid,
	"is_verified" boolean DEFAULT false NOT NULL,
	"status" "organization_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "professions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"trust_level" "trust_level" DEFAULT 'MEDIUM' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_profession_id_professions_id_fk" FOREIGN KEY ("profession_id") REFERENCES "public"."professions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professions" ADD CONSTRAINT "professions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_articles_status_idx" ON "career_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "career_articles_category_idx" ON "career_articles" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "career_articles_slug_unique" ON "career_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_is_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "job_sources_job_id_idx" ON "job_sources" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_sources_source_id_idx" ON "job_sources" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_deadline_idx" ON "jobs" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "jobs_organization_id_idx" ON "jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "jobs_category_id_idx" ON "jobs" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "jobs_profession_id_idx" ON "jobs" USING btree ("profession_id");--> statement-breakpoint
CREATE INDEX "jobs_location_id_idx" ON "jobs" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "jobs_employment_type_idx" ON "jobs" USING btree ("employment_type");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_slug_unique" ON "jobs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "locations_type_idx" ON "locations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "locations_parent_id_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_is_active_idx" ON "locations" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_slug_unique" ON "locations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organizations_status_idx" ON "organizations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organizations_location_id_idx" ON "organizations" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "professions_category_id_idx" ON "professions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "professions_is_active_idx" ON "professions" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "professions_slug_unique" ON "professions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sources_source_type_idx" ON "sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "sources_is_active_idx" ON "sources" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_name_unique" ON "sources" USING btree ("name");