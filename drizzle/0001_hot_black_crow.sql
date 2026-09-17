CREATE TABLE "kb_expansion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mode" text NOT NULL,
	"domain" text,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"domains_processed" jsonb DEFAULT '[]'::jsonb NOT NULL
);
