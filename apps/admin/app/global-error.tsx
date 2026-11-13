'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[KJIN Admin Global Error]:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 flex items-center justify-center min-h-screen p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-lg font-bold text-white">Application Error</h2>
          <p className="text-xs text-slate-400">
            A critical error occurred while loading the administrative interface.
          </p>
          {error?.message && (
            <div className="p-3 bg-slate-950 rounded-xl text-left text-[11px] font-mono text-red-300 border border-slate-800 max-h-32 overflow-x-auto">
              {error.message}
            </div>
          )}
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Reload Interface
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
            >
              Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
