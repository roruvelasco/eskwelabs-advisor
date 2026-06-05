import type { MiddlewareHandler } from 'hono';

import { forbidden, unauthorized } from '../http/http-exception';
import type { Actor, ActorRole } from '../utils/hono';
import type { UsersService } from '../../users/users.service';

function resolveActorFromHeaders(headers: Headers): Actor | null {
  const email = headers.get('x-eskwelabs-actor-email')?.toLowerCase();
  const id = headers.get('x-eskwelabs-actor-id');

  if (!email || !id) return null;

  const roleHeader = headers.get('x-eskwelabs-actor-role') as ActorRole | null;
  const isActive = headers.get('x-eskwelabs-actor-active') !== 'false';

  return { id, email, role: roleHeader ?? 'eif', isActive };
}

export function createAuthMiddleware(
  usersService: UsersService
): MiddlewareHandler {
  return async (c, next) => {
    const forwarded = resolveActorFromHeaders(c.req.raw.headers);
    if (!forwarded) {
      await next();
      return;
    }

    const actor = await usersService.findById(forwarded.id);
    if (!actor || !actor.isActive) {
      await next();
      return;
    }
    if (actor.email.toLowerCase() !== forwarded.email.toLowerCase()) {
      await next();
      return;
    }

    c.set('actor', {
      id: actor.id,
      email: actor.email,
      role: actor.role,
      isActive: actor.isActive
    });

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
