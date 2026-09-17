import { NextResponse } from 'next/server';
import { getSubmissionBytes } from '@/lib/blob-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rollNumber = searchParams.get('roll');
  if (!rollNumber) {
    return NextResponse.json({ error: 'Missing roll number.' }, { status: 400 });
  }

  const result = await getSubmissionBytes(rollNumber);
  if (!result) {
    return NextResponse.json({ error: 'No submission on file.' }, { status: 404 });
  }

  const safeName = `${rollNumber}_${result.filename}`.replace(/[^\w.\-]/g, '_');
  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  });
}
