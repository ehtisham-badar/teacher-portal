import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getRoster, getSubmissionBytes } from '@/lib/blob-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  try {
    const roster = await getRoster();
    const submitted = roster.filter((s) => s.submitted);

    if (submitted.length === 0) {
      return NextResponse.json({ error: 'No submissions to download yet.' }, { status: 404 });
    }

    const zip = new JSZip();
    const usedNames = new Set<string>();

    for (const student of submitted) {
      const result = await getSubmissionBytes(student.rollNumber);
      if (!result) continue;

      let safeName = `${student.rollNumber}_${student.name}`.replace(/[^\w.\- ]/g, '_').trim();
      if (!safeName.toLowerCase().endsWith('.docx')) safeName += '.docx';
      // Guard against duplicate filenames colliding inside the zip.
      let finalName = safeName;
      let n = 2;
      while (usedNames.has(finalName)) {
        finalName = safeName.replace(/\.docx$/i, ` (${n}).docx`);
        n++;
      }
      usedNames.add(finalName);

      zip.file(finalName, result.buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="EC-334_submissions_${today}.zip"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build the zip.' },
      { status: 500 },
    );
  }
}
