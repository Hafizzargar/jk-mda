export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-widest">
          Loading KJIN...
        </span>
      </div>
    </div>
  );
}
