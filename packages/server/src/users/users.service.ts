import { UsersRepository } from './users.repository';

export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async list() {
    return this.usersRepository.list();
  }

  async acknowledgeConsent(userId: string) {
    return this.usersRepository.acknowledgeConsent(userId);
  }
}
