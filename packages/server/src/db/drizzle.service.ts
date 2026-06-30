import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ServerEnv } from '../config/env';
import * as schema from './drizzle-schema';

type DrizzleDb = PostgresJsDatabase<typeof schema>;
export type DbTransaction = Parameters<
  Parameters<DrizzleDb['transaction']>[0]
>[0];

declare global {
  var __drizzle_client: postgres.Sql | undefined;
}

export class DrizzleService {
  private client: postgres.Sql;
  private closed = false;
  db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(env?: Pick<ServerEnv, 'DATABASE_URL' | 'RUNTIME_PROFILE'>) {
    const url =
      env?.DATABASE_URL ??
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

    const isLocal =
      url.includes('127.0.0.1') ||
      url.includes('localhost') ||
      url.includes('0.0.0.0') ||
      env?.RUNTIME_PROFILE === 'demo';

    if (globalThis.__drizzle_client) {
      this.client = globalThis.__drizzle_client;
    } else {
      this.client = postgres(url, {
        prepare: false,
        max: 10,
        idle_timeout: 30,
        ...(isLocal ? {} : { ssl: 'require' })
      });
      globalThis.__drizzle_client = this.client;
  }

    this.db = drizzle(this.client, { schema, casing: 'snake_case' });
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.client === globalThis.__drizzle_client) return;
    await this.client.end();
  }
}
