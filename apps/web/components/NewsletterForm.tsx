'use client';

import { useState } from 'react';

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Failed to subscribe. Please try again.');
      } else {
        setStatus('success');
        setMessage(data.message || 'Subscribed successfully!');
        setEmail('');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again later.');
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-lg p-4 text-emerald-300 text-sm">
        <p className="font-semibold mb-1">&#10003; {message}</p>
        <p className="text-xs text-emerald-400/80">You will receive tomorrow morning&apos;s editorial dispatch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          disabled={status === 'loading'}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 flex-grow disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-cyan-500 text-slate-950 font-bold rounded-lg px-5 py-2.5 text-sm hover:bg-cyan-400 transition disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && (
        <p className="text-xs text-red-400">{message}</p>
      )}
    </form>
  );
}
