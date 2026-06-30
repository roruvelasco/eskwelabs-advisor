import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = postgres(databaseUrl);

const advisorId = process.argv[2];

if (!advisorId) {
  console.error('Usage: bun run advisors:publish <advisor-id>');
  const advisors = await sql`
    SELECT id FROM advisors WHERE is_active = true ORDER BY id
  `;
  console.error(`Available: ${advisors.map((a) => a.id).join(', ')}`);
  process.exit(1);
}

try {
  const [advisor] = await sql`
    SELECT id, name, is_active, status, prompt_doc_id FROM advisors WHERE id = ${advisorId}
  `;

  if (!advisor) {
    console.error(`Advisor "${advisorId}" not found in database.`);
    process.exit(1);
  }

  if (!advisor.is_active) {
    console.error(`Advisor "${advisorId}" is inactive.`);
    process.exit(1);
  }

  if (advisor.status !== 'active') {
    console.error(`Advisor "${advisorId}" is not active.`);
    process.exit(1);
  }

  if (!advisor.prompt_doc_id) {
    console.error(`Advisor "${advisorId}" has no prompt Doc ID.`);
    process.exit(1);
  }

  const [modelConfig] = await sql`
    SELECT advisor_id, provider, model, is_enabled
    FROM model_config WHERE advisor_id = ${advisorId}
  `;

  if (!modelConfig) {
    console.error(`No model configuration found for "${advisorId}".`);
    process.exit(1);
  }

  if (!modelConfig.is_enabled) {
    console.error(`Model configuration for "${advisorId}" is disabled.`);
    process.exit(1);
  }

  const [snapshot] = await sql`
    SELECT id, hash, revision
    FROM prompt_snapshots
    WHERE advisor_id = ${advisorId} AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!snapshot) {
    console.error(
      `No active prompt snapshot found for "${advisorId}". Run db:sync-advisors or bootstrap first.`
    );
    process.exit(1);
  }

  const [digest] = await sql`
    SELECT id, hash FROM dna_digests WHERE is_active = true LIMIT 1
  `;

  if (!digest) {
    console.error('No active DNA digest found.');
    process.exit(1);
  }

  const nextVersion = await sql`
    SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
    FROM advisor_runtime_versions
    WHERE advisor_id = ${advisorId}
  `.then((rows: Array<{ next_version: number }>) => rows[0].next_version);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE advisor_runtime_versions
      SET status = 'retired'
      WHERE advisor_id = ${advisorId} AND status = 'published'
    `;

    const [version] = await tx`
      INSERT INTO advisor_runtime_versions
        (advisor_id, prompt_snapshot_id, dna_digest_id, model_config_advisor_id, version_number, status, published_at)
      VALUES
        (${advisorId}, ${snapshot.id}, ${digest.id}, ${modelConfig.advisor_id}, ${nextVersion}, 'published', NOW())
      RETURNING id
    `;

    await tx`
      UPDATE advisors SET active_runtime_version_id = ${version.id} WHERE id = ${advisorId}
    `;

    console.log(
      `Published ${advisorId} version ${nextVersion} (${version.id.slice(0, 8)})`
    );
  });
} finally {
  await sql.end();
}
