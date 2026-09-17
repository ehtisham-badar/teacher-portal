# EC-334 Admin Portal

Your instructor dashboard: see every student, who's submitted, download any
single file, or download everything at once as a zip. Password-protected.

## What this is

Reads and writes the **same** Vercel Blob store as the student portal — same
`data/students.json` "database", same `submissions/*.docx` files. This app
adds nothing new on the storage side; it's a different, admin-only view and
a couple of admin-only actions (add a student, clear a submission, zip
download) over that shared data.

## Deploy this

This must be a **separate Vercel project** from the student portal (per your
request that they deploy independently), but it needs to point at the
**same Blob store** so it sees the same submissions.

### 1. Push this folder to its own GitHub repo (or subfolder — see CLI path below)

### 2. Import it as a new Vercel project

### 3. Set environment variables — Project Settings → Environment Variables
| Variable | Value |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | **The exact same value** you copied from the student portal's Blob store. Do not create a second Blob store here — reuse the token from the one the student portal made. |
| `ADMIN_PASSWORD` | Any password you choose. This is what gates the dashboard. |

### 4. Redeploy
Env vars only apply to new deployments — redeploy after setting them.

### Alternative: deploy via CLI
```bash
npm i -g vercel
cd admin-portal
vercel link
vercel env add BLOB_READ_WRITE_TOKEN production   # paste the SAME token as the student portal
vercel env add ADMIN_PASSWORD production          # pick a password
vercel --prod
```

## Local development
```bash
cp .env.example .env.local
# fill in BLOB_READ_WRITE_TOKEN (same as student portal) and ADMIN_PASSWORD
npm install
npm run dev
```

## How the login works
A simple password gate, not full auth: `proxy.ts` (Next.js 16's replacement
for `middleware.ts`) checks for a cookie matching `ADMIN_PASSWORD` on every
route except `/login`. Correct password → an HttpOnly, Secure cookie is set
for 8 hours. This is intentionally lightweight — good enough for "keep
random visitors out," not built for anything higher-stakes. Say so if you
want proper multi-admin accounts instead of one shared password.

## Design notes / tradeoffs worth knowing
- Same public-blob-URL tradeoff as the student portal (see its README) —
  the SDK's available API shaped that decision, not a preference.
- "Clear submission" here does the same thing as the student's own "Remove"
  button — it deletes that student's stored file and flips their status
  back to not-submitted. There's no "remove student from roster entirely"
  action; only adding is exposed by design, since removing a roster row
  felt like something you'd want to confirm out loud rather than have a
  stray click undo.
- The zip is built in-memory per request (via `jszip`), not cached — for a
  class-sized roster this is fast; it would need rethinking well before
  thousands of files.
