import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { createContainer, AuthService } from '@eskwelabs-advisor/server';

type AuthResolver = Pick<
  AuthService,
  'resolveActor' | 'resolveLogin' | 'resolveCredentials'
>;
type LoginActor = Awaited<ReturnType<AuthService['resolveLogin']>>;

const defaultAuthService = createContainer().get(AuthService);
const authServiceUnavailableUrl = '/login?error=AuthServiceUnavailable';

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

export function createAuthConfig(authService: AuthResolver): NextAuthOptions {
  return {
    providers: [
      ...(process.env.NODE_ENV !== 'production'
        ? [
            Credentials({
              name: 'credentials',
              credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
              },
              async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;
                const actor = await authService.resolveCredentials(
                  credentials.email,
                  credentials.password
                );
                if (!actor) return null;
                return {
                  id: actor.id,
                  email: actor.email,
                  name: actor.email.split('@')[0]
                };
              }
            })
          ]
        : []),
      Google({
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
          (session.user as { id: string; email: string }).id =
            token.id as string;
          (session.user as { id: string; email: string }).email =
            token.email as string;
        }
        return session;
      },
      async signIn({ user }) {
        const email = user.email?.toLowerCase();
        if (!email) {
          return false;
        }
        const actor = await resolveLoginForAuth(authService, email, 'signIn');
        if (actor === 'service_unavailable') {
          return authServiceUnavailableUrl;
        }
        if (!actor) {
          console.warn('auth_rejected_not_in_allowlist', { email });
          return '/login?error=NotAllowlisted';
        }
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
