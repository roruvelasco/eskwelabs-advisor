import { Repository } from '../common/factories/repository.factory';

const consent = new Map<string, string>();

export class UsersRepository extends Repository {
  async list() {
    return [];
  }

  async acknowledgeConsent(userId: string) {
    const acknowledgedAt = new Date().toISOString();
    consent.set(userId, acknowledgedAt);
    return { userId, acknowledgedAt };
  }
}
