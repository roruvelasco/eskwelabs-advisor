import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

const csv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
  console.warn(
    'NextAuth: AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET is not set. Google OAuth will fail until configured.'
  );
}

export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true
    })
  ],
  pages: {
    signIn: '/login',
    error: '/login'
  },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const protectedRoutes = [
        '/advisors',
        '/chat',
        '/history',
        '/consent',
        '/api/advisors',
        '/api/conversations',
        '/api/messages',
        '/api/chat-turn',
        '/api/consent',
        '/admin',
        '/api/admin'
      ];

      const isProtected = protectedRoutes.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );

      if (!isProtected) return true;
      return !!auth?.user;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email?.toLowerCase();
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },

    async signIn({ user }) {
      const email = user.email?.toLowerCase();

      if (!email) {
        return false;
      }

      const adminEmails = csv(process.env.ADMIN_EMAILS);
      const eifAllowlist = csv(process.env.EIF_ALLOWLIST_EMAILS);

      const isAdmin = adminEmails.includes(email);
      const isAllowlistedEif = eifAllowlist.includes(email);

      if (!isAdmin && !isAllowlistedEif) {
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
  },
  // Enable debug logs in non-production to surface provider errors
  debug: process.env.NODE_ENV !== 'production'
} satisfies NextAuthConfig;
