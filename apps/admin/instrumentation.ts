export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initBackgroundNewsWorker } = await import('./lib/newsroom/auto-worker');
    initBackgroundNewsWorker();
  }
}

