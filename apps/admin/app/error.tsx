'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[KJIN Admin Error Boundary]:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col justify-center items-center px-4 py-12 text-slate-100">
      <div className="max-w-lg w-full bg-slate-900 rounded-2xl border border-slate-800 shadow-xl p-6 sm:p-8 text-center space-y-4">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-950/80 text-red-300 border border-red-500/40 text-xs font-mono font-bold uppercase tracking-wider">
          <span>⚠️</span>
          <span>Admin Hub Notice</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          Page Could Not Be Loaded
        </h1>
        <p className="text-slate-400 text-xs leading-relaxed">
          The admin server encountered an unexpected error while preparing this workspace view.
        </p>
        {error?.message && (
          <div className="p-3 bg-slate-950 rounded-xl text-left text-xs font-mono text-red-300/90 overflow-x-auto border border-slate-800 max-h-36">
            {error.message}
          </div>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            🔄 Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
