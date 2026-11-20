CREATE TYPE "public"."facebook_approval_state" AS ENUM('NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."facebook_content_use_state" AS ENUM('NOT_RECORDED', 'PENDING', 'AUTHORIZED', 'DENIED');--> statement-breakpoint
CREATE TYPE "public"."facebook_page_kind" AS ENUM('OWNED_PAGE', 'EXTERNAL_PAGE');--> statement-breakpoint
ALTER TYPE "public"."source_type" ADD VALUE 'FACEBOOK';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "facebook_page_id" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "facebook_page_kind" "facebook_page_kind";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "facebook_approval_state" "facebook_approval_state" DEFAULT 'NOT_REQUESTED';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "facebook_content_use_state" "facebook_content_use_state" DEFAULT 'NOT_RECORDED';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "facebook_authorization_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sources_facebook_page_id_unique" ON "sources" USING btree ("facebook_page_id");