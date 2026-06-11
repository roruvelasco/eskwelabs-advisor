import { NextResponse } from 'next/server';

export async function GET() {
  const raw = process.env.DATABASE_URL ?? '';

  try {
    const url = new URL(raw);

    return NextResponse.json({
      username: url.username,
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname
    });
  } catch {
    return NextResponse.json({
      parseFailed: true,
      rawStart: raw.slice(0, 80)
    });
  }
}
