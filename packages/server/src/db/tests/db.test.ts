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
    const service = new DrizzleService({
      DATABASE_URL: 'postgresql://localhost:54322/postgres',
      RUNTIME_PROFILE: 'test'
    });
    let closeCalls = 0;

    service['client'].end = (async () => {
      closeCalls += 1;
    }) as never;

    await service.close();
    await service.close();

    expect(closeCalls).toBe(1);
  });
});
