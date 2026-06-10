import postgres from 'postgres';

import {
  advisorRegistry,
  sharedDnaDocId
} from '../packages/server/src/advisors/advisor-registry';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = postgres(databaseUrl);

try {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO advisors (id, name, description, prompt_doc_id, is_active)
      VALUES
        (${advisorRegistry[0].id}, ${advisorRegistry[0].name}, ${advisorRegistry[0].description}, ${advisorRegistry[0].promptDocId}, true),
        (${advisorRegistry[1].id}, ${advisorRegistry[1].name}, ${advisorRegistry[1].description}, ${advisorRegistry[1].promptDocId}, true),
        (${advisorRegistry[2].id}, ${advisorRegistry[2].name}, ${advisorRegistry[2].description}, ${advisorRegistry[2].promptDocId}, true)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        prompt_doc_id = EXCLUDED.prompt_doc_id,
        is_active = true
    `;

    await tx`
      INSERT INTO model_config (advisor_id, provider, model, is_enabled)
      VALUES
        (${advisorRegistry[0].id}, 'gemini', 'gemini-2.5-flash-lite', true),
        (${advisorRegistry[1].id}, 'gemini', 'gemini-2.5-flash-lite', true),
        (${advisorRegistry[2].id}, 'gemini', 'gemini-2.5-flash-lite', true)
      ON CONFLICT (advisor_id) DO UPDATE SET
        is_enabled = true,
        updated_at = NOW()
    `;

    await tx`
      UPDATE conversations
      SET advisor_id = 'data-modeling'
      WHERE advisor_id = 'advisor-3'
    `;

    await tx`
      UPDATE prompt_snapshots
      SET advisor_id = 'data-modeling'
      WHERE advisor_id = 'advisor-3'
    `;

    await tx`
      UPDATE advisors
      SET is_active = false
      WHERE id = 'advisor-3'
    `;

    await tx`
      UPDATE model_config
      SET is_enabled = false, updated_at = NOW()
      WHERE advisor_id = 'advisor-3'
    `;
  });

  const advisors = await sql`
    SELECT id, name, prompt_doc_id, is_active
    FROM advisors
    WHERE id IN ('data-dashboard', 'ssot-memo', 'data-modeling', 'advisor-3')
    ORDER BY id
  `;

  console.log('Advisor registry synced.');
  console.log(`Set GOOGLE_DOCS_DNA_DOC_ID=${sharedDnaDocId}`);
  for (const advisor of advisors) {
    console.log(
      `${advisor.id}: ${advisor.name} (${advisor.is_active ? 'active' : 'inactive'}) doc=${advisor.prompt_doc_id ?? 'none'}`
    );
  }
} finally {
  await sql.end();
}
