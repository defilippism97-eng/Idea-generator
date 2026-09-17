ALTER TABLE "kb_domains" ADD COLUMN IF NOT EXISTS "origin" text DEFAULT 'auto' NOT NULL;

ALTER TABLE "kb_expansion_jobs" ADD COLUMN IF NOT EXISTS "cancel_requested" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
	ALTER TABLE "kb_documents" ADD CONSTRAINT "kb_documents_domain_id_kb_domains_id_fk"
		FOREIGN KEY ("domain_id") REFERENCES "kb_domains"("id") ON DELETE cascade;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;
