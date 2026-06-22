import type { User } from './users.schema';
import { UsersRepository } from './users.repository';
import type { PaginatedResult } from '../common/pagination';
import type { Actor, ActorRole } from '../common/utils/hono';
import { forbidden } from '../common/http/http-exception';

export class UsersService {
  constructor(private usersRepository: UsersRepository) {}

  async list(
    role?: ActorRole,
    search?: string,
    limit?: number,
    cursor?: string
  ): Promise<PaginatedResult<User>> {
    return this.usersRepository.list({ role, search, limit, cursor });
  }

  async count(): Promise<number> {
    return this.usersRepository.count();
  }

  async findByEmail(email: string): Promise<User | undefined> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | undefined> {
    return this.usersRepository.findById(id);
  }

  async createOrReactivate(
    email: string,
    role: 'eif' | 'admin'
  ): Promise<User> {
    return this.usersRepository.createOrReactivate(email, role);
  }

  async update(
    actor: Actor,
    id: string,
    data: Partial<Pick<User, 'role' | 'isActive'>>
  ): Promise<User | undefined> {
    if (
      actor.id === id &&
      (data.isActive === false || (data.role && data.role !== actor.role))
    ) {
      throw forbidden('Cannot deactivate or demote your own admin account');
    }

    return this.usersRepository.update(id, data);
  }

  async acknowledgeConsent(userId: string) {
    return this.usersRepository.acknowledgeConsent(userId);
  }
}
