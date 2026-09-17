import { NextResponse } from 'next/server';
import { removeSubmission } from '@/lib/blob-helpers';

export async function POST(request: Request) {
  try {
    const { rollNumber } = await request.json();
    if (typeof rollNumber !== 'string' || !rollNumber) {
      return NextResponse.json({ error: 'Missing roll number.' }, { status: 400 });
    }
    const updated = await removeSubmission(rollNumber);
    return NextResponse.json({ roster: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Remove failed.' },
      { status: 500 },
    );
  }
}
