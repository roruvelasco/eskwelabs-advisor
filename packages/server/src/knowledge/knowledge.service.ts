import type { TelemetryService } from '../telemetry/telemetry.service';
import type {
  CreateKnowledgeSourceInput,
  KnowledgeRepository
} from './knowledge.repository';
import type { KnowledgeIngestionService } from './knowledge-ingestion.service';

export class KnowledgeService {
  constructor(
    private knowledgeRepository: KnowledgeRepository,
    private knowledgeIngestionService?: KnowledgeIngestionService,
    private telemetryService?: TelemetryService
  ) {}

  async listSources(input: {
    limit?: number;
    cursor?: string;
    status?: string;
    advisorScope?: string;
  }) {
    return this.knowledgeRepository.listSources(input);
  }

  async createSource(input: CreateKnowledgeSourceInput, actorId?: string) {
    const source = await this.knowledgeRepository.createSource(input);
    await this.recordTelemetry('knowledge_source_created', actorId, 'info', {
      sourceId: source.id,
      sourceType: source.sourceType,
      advisorScope: source.advisorScope,
      contentType: source.contentType
    });
    return source;
  }

  async listUnitsForSource(sourceId: string) {
    return this.knowledgeRepository.listUnitsForSource(sourceId);
  }

  async refreshSource(sourceId: string) {
    if (!this.knowledgeIngestionService) {
      return {
        status: 'skipped' as const,
        code: 'knowledge_ingestion_not_configured'
      };
    }

    const result = await this.knowledgeIngestionService.ingestSource(sourceId);
    return {
      status: 'refreshed' as const,
      sourceId,
      revision: result.source.revision,
      unitCount: result.units.length
    };
  }

  async search(input: { query: string; advisorId?: string; limit?: number }) {
    return this.knowledgeRepository.searchPublishedUnits(input);
  }

  async refreshPublishedSources() {
    if (!this.knowledgeIngestionService) {
      return {
        status: 'skipped' as const,
        results: [],
        code: 'knowledge_ingestion_not_configured'
      };
    }

    const sources = await this.knowledgeRepository.listSources({
      status: 'published',
      limit: 100
    });
    const results =
      await this.knowledgeIngestionService.refreshPublishedSources(
        sources.rows
      );
    const failed = results.filter((result) => result.status === 'failed');

    return {
      status: failed.length > 0 ? ('partial' as const) : ('refreshed' as const),
      results
    };
  }

  async health() {
    return {
      sourceCount: await this.knowledgeRepository.countSources()
    };
  }

  private async recordTelemetry(
    eventName: string,
    actorId: string | undefined,
    severity: 'info' | 'warning' | 'error',
    payload: Record<string, unknown>
  ) {
    try {
      await this.telemetryService?.record(
        eventName,
        actorId,
        severity,
        payload
      );
    } catch {
      return;
    }
  }
}
