import { NextResponse } from 'next/server';
import { addStudent } from '@/lib/blob-helpers';

export async function POST(request: Request) {
  try {
    const { rollNumber, name } = await request.json();
    if (typeof rollNumber !== 'string' || !rollNumber.trim()) {
      return NextResponse.json({ error: 'Roll number is required.' }, { status: 400 });
    }
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    const updated = await addStudent(rollNumber.trim(), name.trim());
    return NextResponse.json({ roster: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not add student.' },
      { status: 400 },
    );
  }
}
