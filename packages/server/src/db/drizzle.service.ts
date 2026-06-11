import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ServerEnv } from '../config/env';
import * as schema from './drizzle-schema';

export class DrizzleService {
  private client: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;

  constructor(env?: Pick<ServerEnv, 'DATABASE_URL'>) {
    this.client = postgres(
      env?.DATABASE_URL ??
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      {
        prepare: false,
        ssl: 'require'
      }
    );
    this.db = drizzle(this.client, { schema, casing: 'snake_case' });
  }
}
