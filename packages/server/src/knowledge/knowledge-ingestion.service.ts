import { createHash } from 'node:crypto';

import type { GoogleDocsClient } from '../adapters/advisor-adapters';
import { HttpException } from '../common/http/http-exception';
import type { TelemetryService } from '../telemetry/telemetry.service';
import type { KnowledgeRepository } from './knowledge.repository';
import type { KnowledgeSource } from './knowledge-sources.schema';
import type { KnowledgeIndexProvider } from './knowledge-providers';

const MAX_UNIT_CHARS = 2400;

function sha256(value: string) {
  return createHash('sha256').update(value.trim()).digest('hex');
}

type ParsedUnit = {
  sectionPath: string;
  text: string;
};

function summarize(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length > 280
    ? `${normalized.slice(0, 277).trim()}...`
    : normalized;
}

function parseUnits(text: string): ParsedUnit[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const units: ParsedUnit[] = [];
  let buffer: string[] = [];
  let sectionPath = 'Document';

  const flush = () => {
    const joined = buffer.join('\n\n').trim();
    if (!joined) return;
    units.push({ sectionPath, text: joined });
    buffer = [];
  };

  for (const paragraph of paragraphs) {
    const looksLikeHeading =
      paragraph.length <= 120 &&
      !paragraph.endsWith('.') &&
      paragraph.split(/\s+/).length <= 12;

    if (looksLikeHeading && buffer.length > 0) {
      flush();
      sectionPath = paragraph;
      continue;
    }

    const nextLength = buffer.join('\n\n').length + paragraph.length;
    if (nextLength > MAX_UNIT_CHARS) flush();
    buffer.push(paragraph);
  }

  flush();
  return units.length > 0 ? units : [{ sectionPath, text: text.trim() }];
}

export class KnowledgeIngestionService {
  constructor(
    private knowledgeRepository: KnowledgeRepository,
    private docsClient: GoogleDocsClient,
    private telemetryService?: TelemetryService,
    private knowledgeIndexProvider?: KnowledgeIndexProvider
  ) {}

  private async recordTelemetry(
    eventName: string,
    severity: 'info' | 'warning' | 'error',
    payload: Record<string, unknown>
  ) {
    try {
      await this.telemetryService?.record(
        eventName,
        undefined,
        severity,
        payload
      );
    } catch {
      return;
    }
  }

  async ingestSource(sourceId: string) {
    const source = await this.knowledgeRepository.findSourceById(sourceId);
    if (!source) {
      throw new HttpException(
        404,
        'Knowledge source not found',
        'knowledge_source_not_found'
      );
    }

    if (source.sourceType !== 'google_doc') {
      throw new HttpException(
        422,
        'Knowledge source type is not supported yet',
        'knowledge_source_type_unsupported'
      );
    }

    await this.recordTelemetry('knowledge_ingestion_started', 'info', {
      sourceId,
      sourceType: source.sourceType,
      externalId: source.externalId
    });

    try {
      const document = await this.docsClient.fetchDocument(source.externalId);
      const sourceHash = sha256(document.text);
      const units = parseUnits(document.text).map((unit) => ({
        sourceId: source.id,
        sourceRevision: document.revision,
        sectionPath: unit.sectionPath,
        contentType: source.contentType,
        advisorScope: source.advisorScope,
        audience: source.audience,
        status: 'published',
        text: unit.text,
        summary: summarize(unit.text),
        contentHash: sha256(unit.text),
        metadata: {
          sourceTitle: source.title,
          sourceType: source.sourceType
        }
      }));

      const rows = await this.knowledgeRepository.replaceUnitsForSourceRevision(
        {
          sourceId: source.id,
          sourceRevision: document.revision,
          units
        }
      );

      const updatedSource =
        await this.knowledgeRepository.updateSourceIngestion({
          sourceId: source.id,
          revision: document.revision,
          sourceHash,
          status: 'published',
          lastIngestedAt: new Date()
        });

      await this.recordTelemetry('knowledge_ingestion_completed', 'info', {
        sourceId,
        revision: document.revision,
        sourceHash,
        unitCount: rows.length
      });

      try {
        await this.knowledgeIndexProvider?.upsert(rows);
        await this.recordTelemetry('knowledge_units_indexed', 'info', {
          sourceId,
          unitCount: rows.length
        });
      } catch {
        await this.recordTelemetry('knowledge_units_index_failed', 'warning', {
          sourceId,
          unitCount: rows.length
        });
      }

      return { source: updatedSource, units: rows };
    } catch (error) {
      await this.knowledgeRepository.updateSourceIngestion({
        sourceId: source.id,
        revision: source.revision ?? 'unknown',
        sourceHash: source.sourceHash ?? '',
        status: 'failed',
        lastIngestedAt: new Date()
      });
      await this.recordTelemetry('knowledge_ingestion_failed', 'error', {
        sourceId,
        code:
          error instanceof Error && 'code' in error
            ? String(error.code)
            : 'knowledge_ingestion_failed'
      });
      throw error;
    }
  }

  async refreshPublishedSources(sources: KnowledgeSource[]) {
    const results = [];
    for (const source of sources) {
      if (source.status !== 'published') continue;
      try {
        const result = await this.ingestSource(source.id);
        results.push({
          sourceId: source.id,
          status: 'refreshed' as const,
          revision: result.source.revision,
          unitCount: result.units.length
        });
      } catch (error) {
        results.push({
          sourceId: source.id,
          status: 'failed' as const,
          code:
            error instanceof Error && 'code' in error
              ? String(error.code)
              : 'knowledge_ingestion_failed'
        });
      }
    }

    return results;
  }
}
