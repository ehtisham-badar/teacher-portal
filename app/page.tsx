'use client';

import { useEffect, useMemo, useState } from 'react';

type Student = {
  rollNumber: string;
  name: string;
  submitted: boolean;
  filename?: string;
  uploadedAt?: string;
};

export default function AdminDashboard() {
  const [roster, setRoster] = useState<Student[] | null>(null);
  const [query, setQuery] = useState('');
  const [busyRoll, setBusyRoll] = useState<string | null>(null);
  const [removingRoll, setRemovingRoll] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [banner, setBanner] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [newRoll, setNewRoll] = useState('');
  const [newName, setNewName] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    loadRoster();
  }, []);

  async function loadRoster() {
    try {
      const res = await fetch('/api/roster');
      const data = await res.json();
      setRoster(data.roster || []);
    } catch {
      setRoster([]);
    }
  }

  function flash(text: string, kind: 'ok' | 'err' = 'ok') {
    setBanner({ text, kind });
    setTimeout(() => setBanner(null), 4000);
  }

  async function handleRemove(rollNumber: string) {
    setBusyRoll(rollNumber);
    try {
      const res = await fetch('/api/remove-submission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not clear submission.');
      setRoster(data.roster);
      flash('Submission cleared.');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed.', 'err');
    } finally {
      setBusyRoll(null);
    }
  }

  async function handleRemoveStudent(rollNumber: string, name: string) {
    const ok = window.confirm(
      `Remove ${name} (${rollNumber}) from the roster? This permanently deletes their submission, if any, and cannot be undone.`,
    );
    if (!ok) return;
    setRemovingRoll(rollNumber);
    try {
      const res = await fetch('/api/remove-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove student.');
      setRoster(data.roster);
      flash(`Removed ${name}.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed.', 'err');
    } finally {
      setRemovingRoll(null);
    }
  }

  function handleDownload(rollNumber: string) {
    window.open(`/api/download?roll=${encodeURIComponent(rollNumber)}`, '_blank');
  }

  async function handleDownloadAll() {
    setZipBusy(true);
    try {
      const res = await fetch('/api/download-all');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not build the zip.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EC-334_submissions_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Zip download failed.', 'err');
    } finally {
      setZipBusy(false);
    }
  }

  async function handleAddStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoll.trim() || !newName.trim()) return;
    setAddBusy(true);
    try {
      const res = await fetch('/api/add-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumber: newRoll.trim(), name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add student.');
      setRoster(data.roster);
      setNewRoll('');
      setNewName('');
      flash(`Added ${newName.trim()}.`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to add student.', 'err');
    } finally {
      setAddBusy(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (roster || []).filter(
      (s) => !q || s.rollNumber.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );
  }, [roster, query]);

  const submittedCount = (roster || []).filter((s) => s.submitted).length;

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '32px 20px 80px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22, color: 'white', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', opacity: 0.85 }}>
            EC-334 · INSTRUCTOR DASHBOARD
          </div>
          <h1 style={{ fontSize: 'clamp(24px,4vw,34px)', textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
            Submissions 📋
          </h1>
        </div>
        <button onClick={handleLogout} style={{ ...pillBtn('rgba(255,255,255,0.2)'), color: 'white' }}>
          Sign out
        </button>
      </header>

      {banner && (
        <div
          style={{
            background: banner.kind === 'ok' ? '#14B8A6' : '#EF4444',
            color: 'white',
            fontWeight: 700,
            padding: '10px 16px',
            borderRadius: 12,
            marginBottom: 16,
          }}
        >
          {banner.text}
        </div>
      )}

      <div
        style={{
          background: 'rgba(255,255,255,0.18)',
          backdropFilter: 'blur(6px)',
          borderRadius: 18,
          padding: '14px 18px',
          marginBottom: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          color: 'white',
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍  Search name or roll number…"
          style={{ flex: 1, minWidth: 220, border: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 15, outline: 'none' }}
        />
        <div style={{ fontWeight: 700, fontFamily: 'var(--display)', whiteSpace: 'nowrap' }}>
          {roster ? `${submittedCount} / ${roster.length} submitted` : 'Loading…'}
        </div>
        <button onClick={handleDownloadAll} disabled={zipBusy || submittedCount === 0} style={pillBtn(zipBusy ? '#9CA3AF' : '#F59E0B')}>
          {zipBusy ? 'Zipping…' : `⬇ Download all (${submittedCount})`}
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: '18px 20px', marginBottom: 22, boxShadow: '0 6px 20px rgba(16,19,49,0.15)' }}>
        <div style={{ fontWeight: 700, fontFamily: 'var(--display)', marginBottom: 10 }}>Add a student</div>
        <form onSubmit={handleAddStudent} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={newRoll}
            onChange={(e) => setNewRoll(e.target.value)}
            placeholder="Roll number"
            style={{ flex: '1 1 160px', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 14 }}
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name"
            style={{ flex: '2 1 220px', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 14 }}
          />
          <button type="submit" disabled={addBusy} style={pillBtn(addBusy ? '#9CA3AF' : '#7C3AED')}>
            {addBusy ? 'Adding…' : '+ Add'}
          </button>
        </form>
      </div>

      {roster === null && <div style={{ textAlign: 'center', color: 'white', padding: 40 }}>Loading roster…</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((s) => {
          const busy = busyRoll === s.rollNumber;
          return (
            <div
              key={s.rollNumber}
              style={{
                background: 'white',
                borderRadius: 16,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
                boxShadow: '0 4px 14px rgba(16,19,49,0.1)',
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 16 }}>{s.name}</div>
                <div style={{ color: 'var(--ink-dim)', fontSize: 12.5, fontFamily: 'monospace' }}>
                  {s.rollNumber}
                  {s.uploadedAt && (
                    <span style={{ marginLeft: 8, fontFamily: 'var(--body)' }}>
                      · {new Date(s.uploadedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <span
                style={{
                  background: s.submitted ? 'linear-gradient(135deg,#14B8A6,#0D9488)' : '#E5E7EB',
                  color: s.submitted ? 'white' : '#6B7280',
                  fontWeight: 700,
                  fontSize: 12.5,
                  padding: '6px 12px',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                }}
              >
                {s.submitted ? '✓ Submitted' : 'Not yet'}
              </span>

              {s.submitted && (
                <>
                  <button onClick={() => handleDownload(s.rollNumber)} style={pillBtn('#2563EB')}>
                    Download
                  </button>
                  <button onClick={() => handleRemove(s.rollNumber)} disabled={busy} style={pillBtn(busy ? '#9CA3AF' : '#EF4444')}>
                    {busy ? 'Clearing…' : 'Clear'}
                  </button>
                </>
              )}
              <button
                onClick={() => handleRemoveStudent(s.rollNumber, s.name)}
                disabled={removingRoll === s.rollNumber}
                style={pillBtn(removingRoll === s.rollNumber ? '#9CA3AF' : '#7F1D1D')}
              >
                {removingRoll === s.rollNumber ? 'Removing…' : 'Remove'}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function pillBtn(color: string): React.CSSProperties {
  return {
    background: color,
    color: 'white',
    border: 'none',
    borderRadius: 12,
    padding: '10px 16px',
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: 'nowrap',
  };
}
