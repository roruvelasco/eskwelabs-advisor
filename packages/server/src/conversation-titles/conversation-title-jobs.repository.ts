import { and, eq, lt, sql } from 'drizzle-orm';

import { Repository } from '../common/factories/repository.factory';
import { conversationTitleJobsTable } from './conversation-title-jobs.schema';
import type { DbTransaction } from '../db/drizzle.service';

export interface ConversationTitleJobRow {
  id: string;
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  provider: string;
  model: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  leaseExpiresAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueConversationTitleJobInput {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  provider: string;
  model: string;
  maxAttempts?: number;
}

export class ConversationTitleJobsRepository extends Repository {
  async enqueueIfAbsent(
    tx: DbTransaction,
    input: EnqueueConversationTitleJobInput
  ): Promise<{ id: string } | null> {
    const rows = await tx
      .insert(conversationTitleJobsTable)
      .values({
        conversationId: input.conversationId,
        userMessageId: input.userMessageId,
        assistantMessageId: input.assistantMessageId,
        provider: input.provider,
        model: input.model,
        maxAttempts: input.maxAttempts ?? 3
      })
      .onConflictDoNothing()
      .returning({ id: conversationTitleJobsTable.id });

    return rows[0] ?? null;
  }

  async findById(id: string): Promise<ConversationTitleJobRow | null> {
    const rows = await this.drizzle.db
      .select()
      .from(conversationTitleJobsTable)
      .where(eq(conversationTitleJobsTable.id, id))
      .limit(1);

    if (rows.length === 0) return null;
    return this.toRow(rows[0]);
  }

  async recoverExpiredLeases(
    now?: Date
  ): Promise<{ requeued: number; failed: number }> {
    const cutoff = now ?? new Date();

    const expiring = await this.drizzle.db
      .select()
      .from(conversationTitleJobsTable)
      .where(
        and(
          eq(conversationTitleJobsTable.status, 'processing'),
          lt(conversationTitleJobsTable.leaseExpiresAt, cutoff)
        )
      );

    let requeued = 0;
    let failed = 0;

    for (const job of expiring) {
      if (job.attempts < job.maxAttempts) {
        await this.drizzle.db
          .update(conversationTitleJobsTable)
          .set({
            status: 'pending',
            leaseExpiresAt: null,
            runAfter: cutoff,
            updatedAt: cutoff
          })
          .where(
            and(
              eq(conversationTitleJobsTable.id, job.id),
              eq(conversationTitleJobsTable.status, 'processing')
            )
          );
        requeued++;
      } else {
        await this.drizzle.db
          .update(conversationTitleJobsTable)
          .set({
            status: 'failed',
            leaseExpiresAt: null,
            updatedAt: cutoff
          })
          .where(
            and(
              eq(conversationTitleJobsTable.id, job.id),
              eq(conversationTitleJobsTable.status, 'processing')
            )
          );
        failed++;
      }
    }

    return { requeued, failed };
  }

  async claimById(
    jobId: string,
    now?: Date
  ): Promise<ConversationTitleJobRow | null> {
    const timestamp = now ?? new Date();
    const leaseExpiry = new Date(timestamp.getTime() + 120_000);

    return this.drizzle.db.transaction(async (tx) => {
      const [job] = await tx.execute<{
        id: string;
        conversation_id: string;
        user_message_id: string;
        assistant_message_id: string;
        provider: string;
        model: string;
        status: string;
        attempts: number;
        max_attempts: number;
        run_after: Date;
        lease_expires_at: Date | null;
        last_error: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        sql`
          SELECT * FROM conversation_title_jobs
          WHERE id = ${jobId}
            AND status = 'pending'
            AND run_after <= ${timestamp}
            AND attempts < max_attempts
          ORDER BY run_after ASC, created_at ASC, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `
      );

      if (!job) return null;

      const [updated] = await tx.execute<{
        id: string;
        conversation_id: string;
        user_message_id: string;
        assistant_message_id: string;
        provider: string;
        model: string;
        status: string;
        attempts: number;
        max_attempts: number;
        run_after: Date;
        lease_expires_at: Date | null;
        last_error: string | null;
        created_at: Date;
        updated_at: Date;
      }>(
        sql`
          UPDATE conversation_title_jobs
          SET
            status = 'processing',
            attempts = attempts + 1,
            lease_expires_at = ${leaseExpiry},
            updated_at = ${timestamp}
          WHERE id = ${jobId}
            AND status = 'pending'
            AND attempts < max_attempts
          RETURNING *
        `
      );

      return updated ? this.toRawRow(updated) : null;
    });
  }

  async claimBatch(
    limit: number,
    now?: Date
  ): Promise<ConversationTitleJobRow[]> {
    const clamped = Math.min(Math.max(limit, 1), 50);
    const timestamp = now ?? new Date();
    const leaseExpiry = new Date(timestamp.getTime() + 120_000);

    const rows = await this.drizzle.db.execute<{
      id: string;
      conversation_id: string;
      user_message_id: string;
      assistant_message_id: string;
      provider: string;
      model: string;
      status: string;
      attempts: number;
      max_attempts: number;
      run_after: Date;
      lease_expires_at: Date | null;
      last_error: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      sql`
        UPDATE conversation_title_jobs
        SET
          status = 'processing',
          attempts = attempts + 1,
          lease_expires_at = ${leaseExpiry},
          updated_at = ${timestamp}
        FROM (
          SELECT id
          FROM conversation_title_jobs
          WHERE status = 'pending'
            AND run_after <= ${timestamp}
            AND attempts < max_attempts
          ORDER BY run_after ASC, created_at ASC, id ASC
          LIMIT ${clamped}
          FOR UPDATE SKIP LOCKED
        ) AS selected
        WHERE conversation_title_jobs.id = selected.id
        RETURNING conversation_title_jobs.*
      `
    );

    return rows.map((r) => this.toRawRow(r));
  }

  async markCompleted(jobId: string): Promise<boolean> {
    const [row] = await this.drizzle.db
      .update(conversationTitleJobsTable)
      .set({
        status: 'completed',
        leaseExpiresAt: null,
        lastError: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(conversationTitleJobsTable.id, jobId),
          eq(conversationTitleJobsTable.status, 'processing')
        )
      )
      .returning({ id: conversationTitleJobsTable.id });

    return !!row;
  }

  async markRetry(
    jobId: string,
    input: { runAfter: Date; error: string }
  ): Promise<boolean> {
    const [row] = await this.drizzle.db
      .update(conversationTitleJobsTable)
      .set({
        status: 'pending',
        runAfter: input.runAfter,
        leaseExpiresAt: null,
        lastError: input.error.slice(0, 1000),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(conversationTitleJobsTable.id, jobId),
          eq(conversationTitleJobsTable.status, 'processing')
        )
      )
      .returning({ id: conversationTitleJobsTable.id });

    return !!row;
  }

  async markFailed(jobId: string, input: { error: string }): Promise<boolean> {
    const [row] = await this.drizzle.db
      .update(conversationTitleJobsTable)
      .set({
        status: 'failed',
        leaseExpiresAt: null,
        lastError: input.error.slice(0, 1000),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(conversationTitleJobsTable.id, jobId),
          eq(conversationTitleJobsTable.status, 'processing')
        )
      )
      .returning({ id: conversationTitleJobsTable.id });

    return !!row;
  }

  private toRawRow(row: {
    id: string;
    conversation_id: string;
    user_message_id: string;
    assistant_message_id: string;
    provider: string;
    model: string;
    status: string;
    attempts: number;
    max_attempts: number;
    run_after: Date;
    lease_expires_at: Date | null;
    last_error: string | null;
    created_at: Date;
    updated_at: Date;
  }): ConversationTitleJobRow {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      userMessageId: row.user_message_id,
      assistantMessageId: row.assistant_message_id,
      provider: row.provider,
      model: row.model,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      runAfter: row.run_after.toISOString(),
      leaseExpiresAt: row.lease_expires_at?.toISOString() ?? undefined,
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }

  private toRow(
    row: typeof conversationTitleJobsTable.$inferSelect
  ): ConversationTitleJobRow {
    return {
      id: row.id,
      conversationId: row.conversationId,
      userMessageId: row.userMessageId,
      assistantMessageId: row.assistantMessageId,
      provider: row.provider,
      model: row.model,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      runAfter: row.runAfter.toISOString(),
      leaseExpiresAt: row.leaseExpiresAt?.toISOString(),
      lastError: row.lastError ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }
}
