import { paginatedResponse } from '../common/pagination';
import type { MessageRow } from './messages.repository';

export class MessagesSerializer {
  private serialize(row: MessageRow) {
    return {
      id: row.id,
      conversationId: row.conversationId,
      role: row.role,
      content: row.content,
      provider: row.provider,
      model: row.model,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      estimatedCostUsd: row.estimatedCostUsd,
      latencyMs: row.latencyMs,
      status: row.status,
      blockReason: row.blockReason,
      promptDocRevision: row.promptDocRevision,
      dnaDigestVersion: row.dnaDigestVersion,
      clientTurnId: row.clientTurnId,
      seq: row.seq,
      createdAt: row.createdAt
    };
  }

  list(result: { rows: MessageRow[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map((row) => this.serialize(row)),
      result.rows.length,
      result.nextCursor
    );
  }
}
