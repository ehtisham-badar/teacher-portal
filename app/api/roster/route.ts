import { NextResponse } from 'next/server';
import { getRoster } from '@/lib/blob-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[DEBUG] BLOB_READ_WRITE_TOKEN present:', !!process.env.BLOB_READ_WRITE_TOKEN, 'length:', process.env.BLOB_READ_WRITE_TOKEN?.length);
  console.log('[DEBUG] BLOB_STORE_ID:', process.env.BLOB_STORE_ID);
  console.log('[DEBUG] VERCEL_OIDC_TOKEN present:', !!process.env.VERCEL_OIDC_TOKEN);
  try {
    const roster = await getRoster();
    return NextResponse.json({ roster });
  } catch (err) {
    console.log('[DEBUG] getRoster threw:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load roster' },
      { status: 500 },
    );
  }
}