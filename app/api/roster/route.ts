import { NextResponse } from 'next/server';
import { getRoster } from '@/lib/blob-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const roster = await getRoster();
    return NextResponse.json({ roster });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load roster' },
      { status: 500 },
    );
  }
}
