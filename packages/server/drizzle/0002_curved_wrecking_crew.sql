ALTER TABLE "dna_digests" ADD COLUMN "source_hash" text DEFAULT '' NOT NULL;--> statement-breakpoint
WITH ranked AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "advisor_id"
			ORDER BY "created_at" DESC, "id" DESC
		) AS "active_rank"
	FROM "prompt_snapshots"
	WHERE "is_active" = true
)
UPDATE "prompt_snapshots"
SET "is_active" = false
FROM ranked
WHERE "prompt_snapshots"."id" = ranked."id"
	AND ranked."active_rank" > 1;--> statement-breakpoint
WITH ranked AS (
	SELECT
		"id",
		row_number() OVER (
			ORDER BY "created_at" DESC, "id" DESC
		) AS "active_rank"
	FROM "dna_digests"
	WHERE "is_active" = true
)
UPDATE "dna_digests"
SET "is_active" = false
FROM ranked
WHERE "dna_digests"."id" = ranked."id"
	AND ranked."active_rank" > 1;--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_snapshots_one_active_per_advisor_idx" ON "prompt_snapshots" USING btree ("advisor_id") WHERE "prompt_snapshots"."is_active" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "dna_digests_one_active_idx" ON "dna_digests" USING btree ("is_active") WHERE "dna_digests"."is_active" = true;
