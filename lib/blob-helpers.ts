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

async function blobExists(pathname: string): Promise<boolean> {
  const result = await get(pathname, { access: 'public', useCache: false });
  return result !== null;
}

/**
 * Retries `check` (a cache-bypassing read) until it reports the change has
 * landed, instead of trusting the write call alone. Used after a delete so
 * callers only report success -- and the UI only refreshes its list -- once
 * storage actually reflects the removal.
 */
async function pollUntil(check: () => Promise<boolean>, attempts = 5, delayMs = 300): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (await check()) return true;
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
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

/**
 * Deletes a student's stored submission and marks them not-submitted. Only
 * resolves once the file's deletion and the roster update are both confirmed
 * by a fresh read from storage -- the caller (and the UI's list refresh)
 * should never see this succeed on an assumption alone.
 */
export async function removeSubmission(rollNumber: string): Promise<Student[]> {
  try {
    await del(submissionPath(rollNumber));
  } catch {
    // already gone -- fine, still clear the roster flag below
  }
  const fileGone = await pollUntil(async () => !(await blobExists(submissionPath(rollNumber))));
  if (!fileGone) {
    throw new Error('Could not confirm the file was deleted from storage. Please try again.');
  }

  const roster = await getRoster();
  const updated = roster.map((s) =>
    s.rollNumber === rollNumber
      ? { ...s, submitted: false, filename: undefined, uploadedAt: undefined }
      : s,
  );
  await saveRoster(updated);

  let verified: Student[] | null = null;
  await pollUntil(async () => {
    const check = await getRoster();
    if (!check.some((s) => s.rollNumber === rollNumber && s.submitted)) {
      verified = check;
      return true;
    }
    return false;
  });
  if (!verified) {
    throw new Error('Could not confirm the removal was saved. Please try again.');
  }
  return verified;
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

/**
 * Deletes a student's submission (if any) and drops their roster row
 * entirely. Only resolves once both the file's deletion and the roster
 * update are confirmed by a fresh read from storage.
 */
export async function removeStudent(rollNumber: string): Promise<Student[]> {
  try {
    await del(submissionPath(rollNumber));
  } catch {
    // no submission to delete -- fine
  }
  const fileGone = await pollUntil(async () => !(await blobExists(submissionPath(rollNumber))));
  if (!fileGone) {
    throw new Error('Could not confirm the file was deleted from storage. Please try again.');
  }

  const roster = await getRoster();
  const updated = roster.filter((s) => s.rollNumber !== rollNumber);
  await saveRoster(updated);

  let verified: Student[] | null = null;
  await pollUntil(async () => {
    const check = await getRoster();
    if (!check.some((s) => s.rollNumber === rollNumber)) {
      verified = check;
      return true;
    }
    return false;
  });
  if (!verified) {
    throw new Error('Could not confirm the student was removed from the roster. Please try again.');
  }
  return verified;
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
