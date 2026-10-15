CREATE TABLE "email_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_key" text NOT NULL,
	"ip" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_verifications_token_hash_unique" ON "email_verifications" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verifications_expires_at_idx" ON "email_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "login_failures_account_key_attempted_at_idx" ON "login_failures" USING btree ("account_key","attempted_at");