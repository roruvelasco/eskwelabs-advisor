import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET
  });

  if (!token?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/consent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eskwelabs-actor-email': String(token.email),
          'x-eskwelabs-actor-id': String(token.sub ?? ''),
          'x-eskwelabs-actor-role': 'eif'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to acknowledge consent in backend');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error acknowledging consent:', error);
    return NextResponse.json(
      { error: 'Failed to acknowledge consent' },
      { status: 500 }
    );
  }
}
