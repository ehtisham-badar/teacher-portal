import { put, del, get } from '@vercel/blob';
import { SEED_STUDENTS } from './seed-data';

export type Student = {
  rollNumber: string;
  name: string;
  submitted: boolean;
  filename?: string;
  uploadedAt?: string;
};

const ROSTER_PATH = 'data/students.json';
const submissionPath = (rollNumber: string) => `submissions/${rollNumber}.docx`;

// NOTE on access level: blobs are stored with access: 'public' (URLs aren't
// publicly discoverable -- each has a long random per-store hash -- but
// they're not cryptographically access-controlled either. Fine for a
// classroom tool, worth upgrading if this ever stores something sensitive.
//
// NOTE on useCache: false -- roster/submission blobs are overwritten in place
// at the same pathname (allowOverwrite: true) on every change. Vercel's CDN
// can keep serving the pre-overwrite bytes for up to ~60s after a write, so a
// plain read right after a change (e.g. remove a student, then reload) could
// come back stale. useCache: false forces the read to skip the CDN and hit
// origin storage directly.

async function fetchBlobText(pathname: string): Promise<string | null> {
  const result = await get(pathname, { access: 'public', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return await new Response(result.stream).text();
}

async function fetchBlobBuffer(pathname: string): Promise<Buffer | null> {
  const result = await get(pathname, { access: 'public', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const arrayBuf = await new Response(result.stream).arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Reads the roster+submission-status "database" from Blob storage.
 * On first run (no roster blob exists yet), self-seeds from SEED_STUDENTS
 * so the app works immediately after deploy with no manual setup step.
 */
export async function getRoster(): Promise<Student[]> {
  const text = await fetchBlobText(ROSTER_PATH);
  if (text !== null) {
    return JSON.parse(text);
  }
  const seeded: Student[] = SEED_STUDENTS.map((s) => ({ ...s, submitted: false }));
  await saveRoster(seeded);
  return seeded;
}

export async function saveRoster(roster: Student[]): Promise<void> {
  await put(ROSTER_PATH, JSON.stringify(roster, null, 2), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

/** Stores an uploaded .docx for a student and marks them submitted in the roster. */
export async function saveSubmission(
  rollNumber: string,
  filename: string,
  fileBuffer: ArrayBuffer,
): Promise<Student[]> {
  await put(submissionPath(rollNumber), fileBuffer, {
    access: 'public',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    allowOverwrite: true,
  });
  const roster = await getRoster();
  const updated = roster.map((s) =>
    s.rollNumber === rollNumber
      ? { ...s, submitted: true, filename, uploadedAt: new Date().toISOString() }
      : s,
  );
  await saveRoster(updated);
  return updated;
}

/** Deletes a student's stored submission and marks them not-submitted. */
export async function removeSubmission(rollNumber: string): Promise<Student[]> {
  try {
    await del(submissionPath(rollNumber));
  } catch {
    // already gone -- fine, still clear the roster flag below
  }
  const roster = await getRoster();
  const updated = roster.map((s) =>
    s.rollNumber === rollNumber
      ? { ...s, submitted: false, filename: undefined, uploadedAt: undefined }
      : s,
  );
  await saveRoster(updated);
  return updated;
}

/** Fetches one student's submitted .docx bytes, for review/download. */
export async function getSubmissionBytes(
  rollNumber: string,
): Promise<{ buffer: Buffer; filename: string } | null> {
  const roster = await getRoster();
  const student = roster.find((s) => s.rollNumber === rollNumber);
  if (!student?.submitted) return null;
  const buffer = await fetchBlobBuffer(submissionPath(rollNumber));
  if (!buffer) return null;
  return { buffer, filename: student.filename || `${rollNumber}.docx` };
}

/** Deletes a student's submission (if any) and drops their roster row entirely. */
export async function removeStudent(rollNumber: string): Promise<Student[]> {
  try {
    await del(submissionPath(rollNumber));
  } catch {
    // no submission to delete -- fine
  }
  const roster = await getRoster();
  const updated = roster.filter((s) => s.rollNumber !== rollNumber);
  await saveRoster(updated);
  return updated;
}

/** Adds a new student to the roster (used by the admin "Add student" form). */
export async function addStudent(rollNumber: string, name: string): Promise<Student[]> {
  const roster = await getRoster();
  if (roster.some((s) => s.rollNumber === rollNumber)) {
    throw new Error('A student with that roll number already exists.');
  }
  const updated = [...roster, { rollNumber, name, submitted: false }];
  updated.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
  await saveRoster(updated);
  return updated;
}
