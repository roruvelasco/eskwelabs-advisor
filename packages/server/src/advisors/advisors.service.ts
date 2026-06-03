import { AdvisorsRepository } from './advisors.repository';

export class AdvisorsService {
  constructor(private advisorsRepository: AdvisorsRepository) {}

  async list() {
    return this.advisorsRepository.list();
  }
}
