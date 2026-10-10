import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
        <div className="text-6xl font-black text-blue-900 mb-4 tracking-tighter">404</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Page Not Found</h1>
        <p className="text-slate-600 mb-8 text-sm">
          The dispatch, article, or category you requested does not exist or has been archived.
        </p>
        <Link
          href="/"
          className="inline-block bg-blue-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-800 transition text-sm"
        >
          Return to KJIN Homepage
        </Link>
      </div>
    </main>
  );
}
