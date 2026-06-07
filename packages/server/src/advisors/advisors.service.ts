import { AdvisorsRepository } from './advisors.repository';
import { notFound } from '../common/http/http-exception';

export class AdvisorsService {
  constructor(private advisorsRepository: AdvisorsRepository) {}

  async list() {
    return this.advisorsRepository.list();
  }

  async getActive(id: string) {
    const advisor = await this.advisorsRepository.findActive(id);
    if (!advisor) {
      throw notFound('Advisor not found');
    }
    return advisor;
  }
}
