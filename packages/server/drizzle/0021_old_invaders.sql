CREATE TABLE "dna_source_config" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"doc_id" text NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
