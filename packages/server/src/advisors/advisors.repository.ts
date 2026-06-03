import { Repository } from '../common/factories/repository.factory';

export class AdvisorsRepository extends Repository {
  async list() {
    return [
      { id: 'data-dashboard', name: 'Data Dashboard Advisor' },
      { id: 'ssot-memo', name: 'SSOT Memo Advisor' },
      { id: 'advisor-3', name: 'Advisor 3' }
    ];
  }
}
