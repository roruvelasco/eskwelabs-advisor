import type { NextAuthOptions } from 'next-auth';
import Google from 'next-auth/providers/google';
import { createContainer, AuthService } from '@eskwelabs-advisor/server';

const authService = createContainer().get(AuthService);

if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.warn(
    'NextAuth: AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET is not set. Google OAuth will fail until configured.'
  );
}

export const authConfig = {
  providers: [
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
          const actor = await authService.resolveLogin(email);
          if (actor) {
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
        const actor = await authService.resolveActor(
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
        (session.user as { id: string; email: string }).id = token.id as string;
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
      const actor = await authService.resolveLogin(email);
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
} satisfies NextAuthOptions;
