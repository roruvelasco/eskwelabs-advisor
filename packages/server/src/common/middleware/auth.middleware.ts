import type { MiddlewareHandler } from 'hono';

import { forbidden, unauthorized } from '../http/http-exception';
import type { Actor, ActorRole } from '../utils/hono';
import type { ServerEnv } from '../../config/env';

function resolveActorFromHeaders(
  headers: Headers,
  env: ServerEnv
): Actor | null {
  const email = headers.get('x-eskwelabs-actor-email')?.toLowerCase();
  const id = headers.get('x-eskwelabs-actor-id');

  if (!email || !id) {
    return null;
  }

  const roleHeader = headers.get('x-eskwelabs-actor-role') as ActorRole | null;
  const isAdmin = env.ADMIN_EMAILS.includes(email);
  const role = isAdmin ? 'admin' : roleHeader === 'admin' ? 'admin' : 'eif';
  const isActive = headers.get('x-eskwelabs-actor-active') !== 'false';

  return { id, email, role, isActive };
}

export function createAuthMiddleware(env: ServerEnv): MiddlewareHandler {
  return async (c, next) => {
    const actor = resolveActorFromHeaders(c.req.raw.headers, env);

    if (actor) {
      c.set('actor', actor);
    }

    await next();
  };
}

export function requireActor(roles: ActorRole[]): MiddlewareHandler {
  return async (c, next) => {
    const actor = c.get('actor');

    if (!actor) {
      throw unauthorized();
    }

    if (!actor.isActive) {
      console.warn('inactive_actor_denied', {
        actorId: actor.id,
        email: actor.email
      });
      throw forbidden('Account is inactive');
    }

    if (!roles.includes(actor.role)) {
      throw forbidden();
    }

    await next();
  };
}

export function requireAllowlistedEifOrAdmin(
  env: ServerEnv
): MiddlewareHandler {
  return async (c, next) => {
    const actor = c.get('actor');

    if (!actor) {
      throw unauthorized();
    }

    const isAdmin =
      actor.role === 'admin' && env.ADMIN_EMAILS.includes(actor.email);
    const isEif =
      actor.role === 'eif' && env.EIF_ALLOWLIST_EMAILS.includes(actor.email);

    if (!actor.isActive || (!isAdmin && !isEif)) {
      console.warn('allowlist_denied', {
        actorId: actor.id,
        email: actor.email,
        role: actor.role,
        isActive: actor.isActive
      });
      throw forbidden();
    }

    await next();
  };
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  c.set('actor', {
    id: 'stub-user-id',
    email: 'stub@example.com',
    role: 'eif',
    isActive: true
  });
  await next();
};
