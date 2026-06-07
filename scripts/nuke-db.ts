import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = postgres(databaseUrl);

await sql.unsafe('DROP OWNED BY CURRENT_USER CASCADE');

console.log('All objects dropped. Ready for fresh migration.');

await sql.end();
