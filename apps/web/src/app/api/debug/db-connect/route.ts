import { NextResponse } from 'next/server';
import postgres from 'postgres';

export async function GET() {
  try {
    const sql = postgres(process.env.DATABASE_URL!, {
      ssl: 'require',
      prepare: false
    });

    const result = await sql`select 1 as ok`;
    await sql.end();

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && 'code' in error ? error.code : undefined
    });
  }
}
