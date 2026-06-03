import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const modelConfigTable = pgTable('model_config', {
  advisorId: text('advisor_id').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});

export type ModelConfig = typeof modelConfigTable.$inferSelect;
