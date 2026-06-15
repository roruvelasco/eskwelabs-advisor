import type { MiddlewareHandler } from 'hono';

import { forbidden, unauthorized } from '../http/http-exception';
import type { Actor, ActorRole } from '../utils/hono';
import type { UsersService } from '../../users/users.service';
import type { ServerEnv } from '../../config/env';

const SIGNATURE_MAX_AGE_SECONDS = 300;

function resolveActorFromHeaders(headers: Headers): Actor | null {
  const email = headers.get('x-eskwelabs-actor-email')?.toLowerCase();
  const id = headers.get('x-eskwelabs-actor-id');

  if (!email || !id) return null;

  const roleHeader = headers.get('x-eskwelabs-actor-role') as ActorRole | null;
  const isActive = headers.get('x-eskwelabs-actor-active') !== 'false';

  return { id, email, role: roleHeader ?? 'eif', isActive };
}

async function verifyActorSignature(
  headers: Headers,
  secret: string,
  method: string,
  path: string
): Promise<boolean> {
  const signature = headers.get('x-eskwelabs-actor-signature');
  const timestamp = headers.get('x-eskwelabs-actor-timestamp');
  const nonce = headers.get('x-eskwelabs-actor-nonce');

  if (!signature || !timestamp || !nonce) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > SIGNATURE_MAX_AGE_SECONDS) {
    return false;
  }

  const actor = resolveActorFromHeaders(headers);
  if (!actor) return false;

  const payload = `${actor.id}:${actor.email}:${actor.role}:${actor.isActive}:${method}:${path}:${timestamp}:${nonce}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  let expectedSig: Uint8Array;
  try {
    expectedSig = Uint8Array.from(
      atob(signature)
        .split('')
        .map((c) => c.charCodeAt(0))
    );
  } catch {
    return false;
  }

  return crypto.subtle.verify(
    'HMAC',
    key,
    expectedSig.slice(),
    encoder.encode(payload)
  );
}

export function createAuthMiddleware(
  usersService: UsersService,
  env?: Pick<ServerEnv, 'ACTOR_FORWARDING_SECRET'>
): MiddlewareHandler {
  return async (c, next) => {
    const forwarded = resolveActorFromHeaders(c.req.raw.headers);
    if (!forwarded) {
      await next();
      return;
    }

    if (env?.ACTOR_FORWARDING_SECRET) {
      const path = new URL(c.req.url).pathname;
      const verified = await verifyActorSignature(
        c.req.raw.headers,
        env.ACTOR_FORWARDING_SECRET,
        c.req.method,
        path
      );
      if (!verified) {
        await next();
        return;
      }
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
      isActive: actor.isActive,
      consentAcknowledgedAt: actor.consentAcknowledgedAt
    });

    await next();
  };
}

export function requireConsent(): MiddlewareHandler {
  return async (c, next) => {
    const actor = c.get('actor');

    if (!actor) {
      throw unauthorized();
    }

    if (actor.role === 'eif' && !actor.consentAcknowledgedAt) {
      throw forbidden('Monitoring notice acknowledgement is required');
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
