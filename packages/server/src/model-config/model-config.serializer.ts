import { modelConfigDto } from './dto/model-config.dto';
import type { ModelConfig } from './model-config.schema';
import { dataResponse } from '../common/pagination';

export class ModelConfigSerializer {
  list(rows: ModelConfig[]) {
    return dataResponse(rows.map((row) => modelConfigDto.parse(row)));
  }
}
