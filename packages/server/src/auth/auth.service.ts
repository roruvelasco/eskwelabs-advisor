import { compare } from 'bcryptjs';

import { UsersService } from '../users/users.service';
import type { Actor } from '../common/utils/hono';

export class AuthService {
  constructor(private usersService: UsersService) {}

  async resolveLogin(email: string): Promise<Actor | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };
  }

  async resolveActor(id: string, email: string): Promise<Actor | null> {
    const user = await this.usersService.findById(id);
    if (!user || !user.isActive) return null;
    if (user.email.toLowerCase() !== email.toLowerCase()) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };
  }

  async resolveCredentials(
    email: string,
    password: string
  ): Promise<Actor | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive || !user.passwordHash) return null;
    const valid = await compare(password, user.passwordHash);
    if (!valid) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };
  }
}
