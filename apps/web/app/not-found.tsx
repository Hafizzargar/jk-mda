import Link from 'next/link';

export default function RootNotFound() {
  return (
    <html lang="en">
      <head>
        <title>404 - Page Not Found | KJIN</title>
        <meta httpEquiv="refresh" content="2;url=/en" />
      </head>
      <body className="min-h-screen bg-stone-100 text-stone-900 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full text-center bg-white border border-stone-300 rounded-2xl p-8 shadow-sm">
          <div className="text-6xl font-black text-amber-700 mb-4 tracking-tighter">404</div>
          <h1 className="text-2xl font-bold text-stone-900 mb-3">Page Not Found</h1>
          <p className="text-stone-600 mb-6 text-sm">
            The dispatch or article you requested does not exist or has been relocated. Redirecting you to the home page...
          </p>
          <Link
            href="/en"
            className="inline-block bg-stone-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-stone-800 transition text-sm"
          >
            Return to KJIN Homepage
          </Link>
        </div>
      </body>
    </html>
  );
}
