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
        'postgres://postgres:postgres@localhost:5432/eskwelabs_advisor'
    );
    this.db = drizzle(this.client, { schema, casing: 'snake_case' });
  }
}
