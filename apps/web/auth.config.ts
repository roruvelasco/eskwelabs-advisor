import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import {
  createContainer,
  AuthService,
  TelemetryService
} from '@eskwelabs-advisor/server';
import type { ActorRole } from '@eskwelabs-advisor/server';

type AuthResolver = Pick<
  AuthService,
  'resolveActor' | 'resolveLogin' | 'resolveCredentials'
>;
type LoginActor = Awaited<ReturnType<AuthService['resolveLogin']>>;
type SessionUserWithActor = {
  id: string;
  email: string;
  role?: string;
  isActive?: boolean;
};
type LoginTelemetryRecorder = Pick<TelemetryService, 'record'>;

const defaultContainer = createContainer();
const defaultAuthService = defaultContainer.get(AuthService);
const defaultTelemetry = defaultContainer.get(TelemetryService);

async function recordLoginTelemetry(
  telemetry: LoginTelemetryRecorder,
  event: string,
  payload: Record<string, unknown>
) {
  try {
    await telemetry.record(event, undefined, 'info', payload);
  } catch {
    // telemetry failure must never block login
  }
}
const roleLogin: Record<ActorRole, string> = {
  eif: '/login',
  admin: '/admin/login'
};

const loginError: Record<'not_in_allowlist' | 'service_unavailable', string> = {
  not_in_allowlist: 'NotAllowlisted',
  service_unavailable: 'AuthServiceUnavailable'
};

function loginRedirect(role: ActorRole, reason: keyof typeof loginError) {
  return `${roleLogin[role]}?error=${loginError[reason]}`;
}

function roleMismatchRedirect(requiredRole: ActorRole, actualRole: ActorRole) {
  const error = actualRole === 'admin' ? 'UseAdminLogin' : 'AdminRequired';
  return `${roleLogin[requiredRole]}?error=${error}`;
}

const providerRole: Record<string, ActorRole> = {
  google: 'eif',
  credentials: 'eif',
  'google-admin': 'admin',
  'credentials-admin': 'admin'
};

if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.warn(
    'NextAuth: AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET is not set. Google OAuth will fail until configured.'
  );
}

async function resolveLoginForAuth(
  authService: AuthResolver,
  email: string,
  context: string
): Promise<LoginActor | 'service_unavailable'> {
  try {
    return await authService.resolveLogin(email);
  } catch (error) {
    console.error('auth_login_resolution_failed', { context, email, error });
    return 'service_unavailable';
  }
}

async function resolveActorForAuth(
  authService: AuthResolver,
  id: string,
  email: string
): Promise<LoginActor> {
  try {
    return await authService.resolveActor(id, email);
  } catch (error) {
    console.error('auth_actor_resolution_failed', { id, email, error });
    return null;
  }
}

async function authorizeCredentialsForAuth(
  authService: AuthResolver,
  email: string,
  password: string,
  context: string
) {
  try {
    return await authService.resolveCredentials(email, password);
  } catch (error) {
    console.error('auth_credentials_resolution_failed', {
      context,
      email,
      error
    });
    return null;
  }
}

export function createAuthConfig(
  authService: AuthResolver,
  telemetry: LoginTelemetryRecorder = defaultTelemetry
): NextAuthOptions {
  return {
    providers: [
      Credentials({
        id: 'credentials',
        name: 'credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;
          const actor = await authorizeCredentialsForAuth(
            authService,
            credentials.email,
            credentials.password,
            'credentials'
          );
          if (!actor) return null;
          return {
            id: actor.id,
            email: actor.email,
            name: actor.email.split('@')[0]
          };
        }
      }),
      Credentials({
        id: 'credentials-admin',
        name: 'admin credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' }
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) return null;
          const actor = await authorizeCredentialsForAuth(
            authService,
            credentials.email,
            credentials.password,
            'credentials-admin'
          );
          if (!actor) return null;
          return {
            id: actor.id,
            email: actor.email,
            name: actor.email.split('@')[0]
          };
        }
      }),
      Google({
        id: 'google',
        name: 'Google',
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        allowDangerousEmailAccountLinking: true
      }),
      Google({
        id: 'google-admin',
        name: 'Google Admin',
        clientId: process.env.AUTH_GOOGLE_ID!,
        clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        allowDangerousEmailAccountLinking: true
      })
    ],
    pages: {
      signIn: '/login',
      error: '/login'
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          const email = user.email?.toLowerCase();
          if (email) {
            const actor = await resolveLoginForAuth(authService, email, 'jwt');
            if (actor !== 'service_unavailable' && actor) {
              token.id = actor.id;
              token.email = actor.email;
              token.role = actor.role;
              token.isActive = actor.isActive;
              token.picture = user.image;
              token.name = user.name;
            }
          }
          return token;
        }

        if (token.id && token.email) {
          const actor = await resolveActorForAuth(
            authService,
            token.id as string,
            token.email as string
          );
          if (actor) {
            token.id = actor.id;
            token.email = actor.email;
            token.role = actor.role;
            token.isActive = actor.isActive;
          } else {
            token.isActive = false;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          const sessionUser = session.user as SessionUserWithActor;
          sessionUser.id = token.id as string;
          sessionUser.email = token.email as string;
          sessionUser.role = token.role as string;
          sessionUser.isActive = token.isActive as boolean;
        }
        return session;
      },
      async signIn({ user, account }) {
        const email = user.email?.toLowerCase();
        if (!email) {
          return false;
        }
        const requiredRole = providerRole[account?.provider ?? ''] ?? 'eif';
        const actor = await resolveLoginForAuth(authService, email, 'signIn');
        if (actor === 'service_unavailable') {
          await recordLoginTelemetry(telemetry, 'login_denied', {
            email,
            reason: 'service_unavailable',
            provider: account?.provider
          });
          return loginRedirect(requiredRole, 'service_unavailable');
        }
        if (!actor) {
          console.warn('auth_rejected_not_in_allowlist', { email });
          await recordLoginTelemetry(telemetry, 'login_denied', {
            email,
            reason: 'not_in_allowlist',
            provider: account?.provider
          });
          return loginRedirect(requiredRole, 'not_in_allowlist');
        }
        if (actor.role !== requiredRole) {
          await recordLoginTelemetry(telemetry, 'login_denied', {
            email,
            reason: 'role_mismatch',
            provider: account?.provider,
            expectedRole: requiredRole,
            actualRole: actor.role
          });
          return roleMismatchRedirect(requiredRole, actor.role);
        }
        await recordLoginTelemetry(telemetry, 'login_success', {
          email,
          role: actor.role,
          provider: account?.provider
        });
        return true;
      }
    },
    events: {
      async signOut() {
        // Cleanup if needed (e.g., invalidate sessions in database)
      }
    },
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      updateAge: 24 * 60 * 60 // 24 hours
    },
    jwt: {
      maxAge: 30 * 24 * 60 * 60 // 30 days
    }
  };
}

export const authConfig = createAuthConfig(defaultAuthService);
