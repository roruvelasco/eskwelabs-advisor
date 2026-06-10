import { NextResponse } from 'next/server';

const sessionCookieNames = [
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'authjs.session-token',
  '__Secure-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
  'eskwelabs_actor_id',
  'eskwelabs_actor_email',
  'eskwelabs_actor_role',
  'eskwelabs_actor_active'
];

export async function POST() {
  const response = NextResponse.json({ success: true });

  for (const name of sessionCookieNames) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: new Date(0),
      path: '/'
    });
  }

  return response;
}
