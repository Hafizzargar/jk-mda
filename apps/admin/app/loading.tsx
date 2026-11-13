export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative w-12 h-12">
        <div className="w-12 h-12 rounded-full border-2 border-slate-700/50 border-t-cyan-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-cyan-400">
          KJIN
        </div>
      </div>
      <p className="text-xs font-mono text-slate-400 animate-pulse tracking-wide uppercase">
        Loading Newsroom Operations...
      </p>
    </div>
  );
}
