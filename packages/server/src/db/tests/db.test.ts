import { describe, expect, test } from 'bun:test';

import * as schema from '../drizzle-schema';
import { DrizzleService } from '../drizzle.service';

describe('db schema', () => {
  test('exports placeholder tables', () => {
    expect(Object.keys(schema).length).toBeGreaterThan(0);
  });

  test('protects runtime-version references with foreign keys', async () => {
    const migration = await Bun.file(
      new URL('../../../drizzle/0009_stiff_switch.sql', import.meta.url)
    ).text();

    expect(migration).toContain(
      'advisors_active_runtime_version_id_advisor_runtime_versions_id_fk'
    );
    expect(migration).toContain(
      'FOREIGN KEY ("active_runtime_version_id") REFERENCES "public"."advisor_runtime_versions"("id")'
    );
    expect(migration).toContain(
      'conversations_advisor_runtime_version_id_advisor_runtime_versions_id_fk'
    );
    expect(migration).toContain(
      'FOREIGN KEY ("advisor_runtime_version_id") REFERENCES "public"."advisor_runtime_versions"("id")'
    );
  });

  test('constrains enum-like text columns at the database layer', async () => {
    const migration = await Bun.file(
      new URL('../../../drizzle/0010_groovy_dragon_lord.sql', import.meta.url)
    ).text();

    expect(migration).toContain(
      `CONSTRAINT "users_role_check" CHECK ("users"."role" in ('eif', 'admin'))`
    );
    expect(migration).toContain(
      `CONSTRAINT "messages_role_check" CHECK ("messages"."role" in ('user', 'assistant'))`
    );
    expect(migration).toContain(
      `CONSTRAINT "messages_status_check" CHECK ("messages"."status" in ('ok', 'blocked', 'error', 'pending', 'streaming'))`
    );
    expect(migration).toContain(
      `CONSTRAINT "conversations_status_check" CHECK ("conversations"."status" in ('active'))`
    );
    expect(migration).toContain(
      `CONSTRAINT "conversations_title_source_check" CHECK ("conversations"."title_source" in ('legacy', 'fallback', 'generated', 'manual'))`
    );
    expect(migration).toContain(
      `CONSTRAINT "telemetry_events_severity_check" CHECK ("telemetry_events"."severity" in ('info', 'warning', 'error'))`
    );
  });

  test('closes the postgres client idempotently', async () => {
    globalThis.__drizzle_client = undefined;
    const service = new DrizzleService({
      DATABASE_URL: 'postgresql://localhost:54322/postgres',
      RUNTIME_PROFILE: 'test'
    });

    await service.close();
    await service.close();

    expect(service['closed']).toBe(true);
  });

  test('RLS is enabled for all app tables including post-0012 additions', async () => {
    const rlsMigration = await Bun.file(
      new URL(
        '../../../drizzle/0014_complete_rls_coverage.sql',
        import.meta.url
      )
    ).text();

    expect(rlsMigration).toContain(
      'ALTER TABLE "telemetry_events" ENABLE ROW LEVEL SECURITY'
    );
    expect(rlsMigration).toContain(
      'ALTER TABLE "usage_limits" ENABLE ROW LEVEL SECURITY'
    );
    expect(rlsMigration).toContain(
      'ALTER TABLE "usage_budget_counters" ENABLE ROW LEVEL SECURITY'
    );

    const auditMigration = await Bun.file(
      new URL('../../../drizzle/0022_chubby_tyger_tiger.sql', import.meta.url)
    ).text();

    expect(auditMigration).toContain(
      'ALTER TABLE "usage_limit_audit_events" ENABLE ROW LEVEL SECURITY'
    );
  });

  test('defines direct-access policies for admin and owner reads', async () => {
    const hardening = await Bun.file(
      new URL('../../../drizzle/0012_db_hardening.sql', import.meta.url)
    ).text();
    const rlsMigration = await Bun.file(
      new URL(
        '../../../drizzle/0014_complete_rls_coverage.sql',
        import.meta.url
      )
    ).text();

    expect(hardening).toContain('eif_read_own_users');
    expect(hardening).toContain('eif_read_own_conversations');
    expect(hardening).toContain('eif_read_own_messages');

    expect(rlsMigration).toContain('admin_full_users');
    expect(rlsMigration).toContain('admin_full_conversations');
    expect(rlsMigration).toContain('admin_full_messages');
    expect(rlsMigration).toContain('public_read_active_advisors');
    expect(rlsMigration).toContain('admin_full_advisors');

    const adminSelectTables = [
      'model_config',
      'usage_counters',
      'usage_limits',
      'telemetry_events'
    ];

    for (const tbl of adminSelectTables) {
      expect(rlsMigration).toContain(`admin_select_${tbl}`);
      expect(rlsMigration).toContain(`admin_full_${tbl}`);
    }

    const auditMigration = await Bun.file(
      new URL('../../../drizzle/0022_chubby_tyger_tiger.sql', import.meta.url)
    ).text();

    expect(auditMigration).toContain('admin_select_usage_limit_audit_events');
    expect(auditMigration).toContain('admin_full_usage_limit_audit_events');
  });

  test('excludes prompt-content and service-only tables from direct read policies', async () => {
    const rlsMigration = await Bun.file(
      new URL(
        '../../../drizzle/0014_complete_rls_coverage.sql',
        import.meta.url
      )
    ).text();

    const serviceOnlyTables = [
      'prompt_snapshots',
      'dna_digests',
      'prompt_cache',
      'advisor_runtime_versions',
      'conversation_title_jobs',
      'usage_budget_counters'
    ];

    for (const tbl of serviceOnlyTables) {
      expect(rlsMigration).not.toContain(`admin_select_${tbl}`);
      expect(rlsMigration).not.toContain(`admin_full_${tbl}`);
    }
  });

  test('initial seed does not contain advisor-3', async () => {
    const seed = await Bun.file(
      new URL('../../../drizzle/0000_mvp_foundation.sql', import.meta.url)
    ).text();

    expect(seed).not.toContain("('advisor-3'");
    expect(seed).toContain("('data-modeling'");
  });
});
