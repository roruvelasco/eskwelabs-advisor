import { Repository } from '../common/factories/repository.factory';
import { getPhilippinesDay } from '../common/utils/day-ph';

export class AdminRepository extends Repository {
  async overview() {
    return {
      status: 'ok',
      dayPh: getPhilippinesDay(),
      sections: ['usage', 'model-config', 'prompt-cache', 'telemetry']
    };
  }
}
