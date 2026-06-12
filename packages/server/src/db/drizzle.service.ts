import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ServerEnv } from '../config/env';
import * as schema from './drizzle-schema';

export class DrizzleService {
  private client: postgres.Sql;
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

    this.client = postgres(url, {
      prepare: false,
      ...(isLocal ? {} : { ssl: 'require' })
    });
    this.db = drizzle(this.client, { schema, casing: 'snake_case' });
  }
}
