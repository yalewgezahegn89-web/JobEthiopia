CREATE TABLE "application_resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_resumes_size_positive" CHECK ("application_resumes"."size" > 0),
	CONSTRAINT "application_resumes_size_max" CHECK ("application_resumes"."size" <= 5242880),
	CONSTRAINT "application_resumes_mime_pdf" CHECK ("application_resumes"."mime_type" = 'application/pdf')
);
--> statement-breakpoint
ALTER TABLE "application_resumes" ADD CONSTRAINT "application_resumes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "application_resumes_application_id_unique" ON "application_resumes" USING btree ("application_id");
