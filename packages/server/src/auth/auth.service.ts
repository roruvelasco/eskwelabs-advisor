import { createHash } from 'node:crypto';
import { compare } from 'bcryptjs';

import { rateLimited } from '../common/http/http-exception';
import type { RedisService } from '../cache/redis.service';
import type { ServerEnv } from '../config/env';
import { UsersService } from '../users/users.service';
import type { Actor } from '../common/utils/hono';

type CredentialLimiterEnv = Pick<
  ServerEnv,
  'CREDENTIAL_LOGIN_LOCKOUT_SECONDS' | 'CREDENTIAL_LOGIN_MAX_ATTEMPTS'
>;

const defaultCredentialLimiterEnv: CredentialLimiterEnv = {
  CREDENTIAL_LOGIN_LOCKOUT_SECONDS: 900,
  CREDENTIAL_LOGIN_MAX_ATTEMPTS: 5
};

export class AuthService {
  private credentialAttempts = new Map<
    string,
    { count: number; expiresAt: number }
  >();

  constructor(
    private usersService: UsersService,
    private redisService?: Pick<RedisService, 'del' | 'incrWithTtl'>,
    private env: CredentialLimiterEnv = defaultCredentialLimiterEnv
  ) {}

  async resolveLogin(email: string): Promise<Actor | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      consentAcknowledgedAt: user.consentAcknowledgedAt
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
      isActive: user.isActive,
      consentAcknowledgedAt: user.consentAcknowledgedAt
    };
  }

  async resolveCredentials(
    email: string,
    password: string
  ): Promise<Actor | null> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.assertCredentialAttemptAllowed(normalizedEmail);

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || !user.isActive || !user.passwordHash) return null;
    const valid = await compare(password, user.passwordHash);
    if (!valid) return null;
    await this.clearCredentialAttempts(normalizedEmail);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      consentAcknowledgedAt: user.consentAcknowledgedAt
    };
  }

  private async assertCredentialAttemptAllowed(email: string) {
    const key = this.credentialAttemptKey(email);
    const limit = this.env.CREDENTIAL_LOGIN_MAX_ATTEMPTS;
    const resetSeconds = this.env.CREDENTIAL_LOGIN_LOCKOUT_SECONDS;
    const count = this.redisService
      ? await this.redisService.incrWithTtl(key, resetSeconds)
      : this.incrMemoryCredentialAttempt(key, resetSeconds);

    if (count <= limit) return;

    throw rateLimited('Too many credential login attempts', {
      count,
      limit,
      remaining: 0,
      resetSeconds
    });
  }

  private async clearCredentialAttempts(email: string) {
    const key = this.credentialAttemptKey(email);
    if (this.redisService) {
      await this.redisService.del(key);
      return;
    }
    this.credentialAttempts.delete(key);
  }

  private incrMemoryCredentialAttempt(key: string, ttlSeconds: number) {
    const now = Date.now();
    const existing = this.credentialAttempts.get(key);
    const count =
      !existing || existing.expiresAt <= now ? 1 : existing.count + 1;
    const expiresAt =
      !existing || existing.expiresAt <= now
        ? now + ttlSeconds * 1000
        : existing.expiresAt;

    this.credentialAttempts.set(key, { count, expiresAt });
    return count;
  }

  private credentialAttemptKey(email: string) {
    const digest = createHash('sha256').update(email).digest('hex');
    return `auth:credentials:${digest.slice(0, 32)}`;
  }
}
