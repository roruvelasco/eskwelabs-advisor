import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Proxy sign-out request to NextAuth signout endpoint so NextAuth clears its cookies.
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/signout`,
      {
        method: 'POST',
        headers: {
          cookie: request.headers.get('cookie') || ''
        }
      }
    );

    if (!res.ok) {
      throw new Error('Failed to sign out via NextAuth');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error signing out:', error);
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
  }
}
