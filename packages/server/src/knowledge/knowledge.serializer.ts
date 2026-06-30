import { paginatedResponse } from '../common/pagination';
import { knowledgeSourceDto, knowledgeUnitDto } from './dto/knowledge.dto';
import type { KnowledgeSource } from './knowledge-sources.schema';
import type { KnowledgeUnit } from './knowledge-units.schema';

export class KnowledgeSerializer {
  sources(result: { rows: KnowledgeSource[]; nextCursor: string | null }) {
    return paginatedResponse(
      result.rows.map((row) => knowledgeSourceDto.parse(row)),
      result.rows.length,
      result.nextCursor
    );
  }

  source(row: KnowledgeSource) {
    return { data: knowledgeSourceDto.parse(row) };
  }

  units(rows: KnowledgeUnit[]) {
    return {
      data: rows.map((row) => knowledgeUnitDto.parse(row))
    };
  }
}
