#!/usr/bin/env bun
import { $ } from 'bun';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function silentPrompt(question: string): Promise<string> {
  const stdin = process.stdin;
  const wasRaw = (stdin as { isRaw?: boolean }).isRaw ?? false;
  stdin.setRawMode?.(true);
  stdin.resume();
  process.stdout.write(question + ' ');

  return new Promise((resolve) => {
    let input = '';
    const onData = (data: Buffer) => {
      const chars = data.toString();
      for (const char of chars) {
        if (char === '\r' || char === '\n') {
          stdin.removeListener('data', onData);
          stdin.setRawMode?.(wasRaw);
          stdin.pause();
          process.stdout.write('\n');
          resolve(input);
          return;
        }
        if (char === '\u0003') process.exit(1);
        if (char === '\u007f' || char === '\b') input = input.slice(0, -1);
        else input += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  Supabase Production Database Seed');
  console.log('═══════════════════════════════════════\n');
  console.log(
    '  Steps: migrate → sync-advisors → bootstrap-demo → seed → validate\n'
  );

  const projectRef =
    process.env.SUPABASE_PROJECT_REF ??
    (await rl.question('Supabase project ref (e.g. wgdvngditxtpsautspgo): '));

  const dbPassword =
    process.env.SUPABASE_DB_PASSWORD ?? (await silentPrompt('DB password:'));

  const host =
    process.env.SUPABASE_POOLER_HOST ??
    'aws-1-ap-southeast-2.pooler.supabase.com';

  const DATABASE_URL = `postgresql://postgres.${projectRef}:${dbPassword}@${host}:6543/postgres?sslmode=require`;

  console.log(`\n  Ref:  ${projectRef}\n  Host: ${host}`);

  const answer = await rl.question('\nSeed Supabase prod? (y/N): ');
  if (!['y', 'yes'].includes(answer.toLowerCase())) {
    console.log('Aborted.');
    process.exit(0);
  }

  process.env.DATABASE_URL = DATABASE_URL;

  const steps: { label: string; cmd: string }[] = [
    { label: 'Running migrations', cmd: 'bun run db:migrate' },
    { label: 'Syncing advisors', cmd: 'bun run db:sync-advisors' },
    { label: 'Bootstrapping demo', cmd: 'bun run db:bootstrap-demo' },
    { label: 'Seeding demo data', cmd: 'bun run scripts/seed.ts' },
    { label: 'Validating runtime', cmd: 'bun run db:validate-runtime' }
  ];

  for (const step of steps) {
    console.log(`\n▶ ${step.label}...`);
    const result = await $`${step.cmd}`.nothrow();
    if (result.exitCode === 0) {
      console.log(`  ✓ done`);
    } else {
      console.error(`  ✗ FAILED (exit ${result.exitCode})`);
      const stdout = result.stdout.toString().trim();
      const stderr = result.stderr.toString().trim();
      if (stdout) console.log(stdout.slice(0, 500));
      if (stderr) console.error(stderr.slice(0, 1000));
      const cont = await rl.question('Continue? (y/N): ');
      if (!['y', 'yes'].includes(cont.toLowerCase())) {
        console.log('Aborted.');
        process.exit(1);
      }
    }
  }

  rl.close();

  console.log('\n═══════════════════════════════════════');
  console.log('  ✅ Seed complete. Deploy the app.');
  console.log('═══════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
