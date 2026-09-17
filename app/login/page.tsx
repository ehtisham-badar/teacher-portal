'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: 'white',
          borderRadius: 20,
          padding: '36px 32px',
          width: '100%',
          maxWidth: 380,
          boxShadow: '0 20px 60px rgba(16,19,49,0.35)',
        }}
      >
        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.08em', color: 'var(--ink-dim)' }}>
          EC-334
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 6 }}>Instructor sign in 🔐</h1>
        <p style={{ color: 'var(--ink-dim)', fontSize: 14, marginBottom: 22 }}>
          Enter the admin password to see submissions.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--line)',
            fontSize: 15,
            marginBottom: 14,
            outline: 'none',
          }}
        />
        {error && (
          <div style={{ color: '#DC2626', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            background: busy ? '#C4C4C4' : 'linear-gradient(135deg,#2563EB,#7C3AED)',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            padding: '13px 16px',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
