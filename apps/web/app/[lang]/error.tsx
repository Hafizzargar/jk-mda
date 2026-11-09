'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Newspaper Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col justify-center items-center px-4 py-12 font-serif">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-stone-200 shadow-md p-6 sm:p-8 text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-mono font-bold uppercase tracking-wider">
          <span>⚠️</span>
          <span>Editorial Wire Notice</span>
        </div>
        <h1 className="font-masthead text-2xl sm:text-3xl font-black text-stone-950 tracking-tight">
          Dispatch Could Not Be Loaded
        </h1>
        <p className="text-stone-600 text-sm leading-relaxed font-sans">
          The newsroom server encountered a temporary delay rendering this corridor edition.
        </p>
        {error?.message && (
          <div className="p-3 bg-stone-100 rounded-lg text-left text-xs font-mono text-stone-700 overflow-x-auto border border-stone-200 max-h-32">
            {error.message}
          </div>
        )}
        <div className="flex items-center justify-center gap-3 pt-2 font-sans">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs transition"
          >
            Reload Dispatch
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold uppercase tracking-wider transition"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

