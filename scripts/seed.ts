import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = postgres(databaseUrl);

const ADMIN_EMAIL = 'admin@example.com';
const INTERN_EMAIL = 'intern@example.com';
const PASSWORD = 'password123';

async function main() {
  console.log('Seeding database...\n');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const users = await sql`
    INSERT INTO users (email, password_hash, role, is_active) VALUES
      (${ADMIN_EMAIL}, ${passwordHash}, 'admin', true),
      (${INTERN_EMAIL}, ${passwordHash}, 'eif', true)
    ON CONFLICT (email) DO UPDATE SET
      password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
      role = EXCLUDED.role,
      is_active = true
    RETURNING id, email, role
  `;
  console.log(`Users: ${users.length} upserted`);
  for (const u of users) console.log(`  ${u.email} (${u.role}) [${u.id}]`);

  const intern = users.find((u) => u.email === INTERN_EMAIL);
  if (!intern) throw new Error('Intern user not found after upsert');

  const advisors =
    await sql`SELECT id, name FROM advisors WHERE is_active = true`;
  console.log(`\nAdvisors: ${advisors.length} found`);
  for (const a of advisors) console.log(`  ${a.id} — ${a.name}`);

  const existingConversations = await sql`
    SELECT advisor_id FROM conversations WHERE user_id = ${intern.id}
  `;
  const existingAdvisorIds = new Set(
    existingConversations.map((c: { advisor_id: string }) => c.advisor_id)
  );

  const sampleMessages: Record<string, { user: string; assistant: string }> = {
    'data-dashboard': {
      user: 'Show me the latest sales trends from the dashboard.',
      assistant:
        'Looking at your dashboard, the key trend is a 12% MoM increase in Q4 revenue driven by the wholesale channel. Your gross margin held steady at 64%. I recommend filtering by region — APAC shows the strongest growth at 18%.'
    },
    'ssot-memo': {
      user: 'Can you review the memo draft for the board meeting?',
      assistant:
        'Your memo clearly states the Q1 objectives. A few suggestions: tighten the financial summary to one paragraph, add a risk mitigation section after the timeline, and include the customer satisfaction benchmark from last month. The core argument is solid.'
    },
    'advisor-3': {
      user: 'What should I prioritize this quarter?',
      assistant:
        'Based on your current metrics, I would prioritize: 1) cash flow optimization — your receivable days crept up to 48, 2) team capacity planning ahead of the Q2 product launch, and 3) customer retention initiatives for your top 10 accounts by revenue.'
    }
  };

  let conversationsCreated = 0;
  let messagesCreated = 0;

  for (const advisor of advisors) {
    if (existingAdvisorIds.has(advisor.id)) {
      console.log(`\nConversation for ${advisor.id}: already exists, skipping`);
      continue;
    }

    const conversationId = randomUUID();
    const title = `Onboarding — ${advisor.name}`;
    const messages = sampleMessages[advisor.id] ?? {
      user: 'Hello, can you help me get started?',
      assistant: `Welcome! I am ${advisor.name}. I am here to help with your questions. What would you like to explore today?`
    };

    await sql`
      INSERT INTO conversations (id, user_id, advisor_id, title, status)
      VALUES (${conversationId}, ${intern.id}, ${advisor.id}, ${title}, 'active')
    `;

    await sql`
      INSERT INTO messages (conversation_id, user_id, role, content) VALUES
        (${conversationId}, ${intern.id}, 'user', ${messages.user}),
        (${conversationId}, ${intern.id}, 'assistant', ${messages.assistant})
    `;

    conversationsCreated++;
    messagesCreated += 2;
    console.log(`\nConversation for ${advisor.id}: created`);
    console.log(`  title: ${title}`);
    console.log(`  messages: user + assistant`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Users           : ${users.length}`);
  console.log(`Advisors found  : ${advisors.length}`);
  console.log(`Conversations   : ${conversationsCreated} created`);
  console.log(`Messages        : ${messagesCreated} created`);
  console.log(`\nSeeding complete.`);
}

try {
  await main();
} catch (error) {
  console.error('Seed failed:', error);
  process.exit(1);
} finally {
  await sql.end();
}
