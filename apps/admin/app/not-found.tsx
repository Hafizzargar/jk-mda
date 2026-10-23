import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="text-6xl font-black text-cyan-400 mb-4 tracking-tighter">404</div>
        <h1 className="text-2xl font-bold text-white mb-3">Admin Resource Not Found</h1>
        <p className="text-slate-400 mb-8 text-sm leading-relaxed">
          The editorial desk, setting, or article record you requested could not be located in the newsroom registry.
        </p>
        <Link
          href="/"
          className="inline-block bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold px-6 py-3 rounded-xl hover:brightness-110 shadow-lg shadow-cyan-950/50 transition text-sm"
        >
          Return to Newsroom Dashboard
        </Link>
      </div>
    </main>
  );
}
