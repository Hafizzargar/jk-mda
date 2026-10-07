// Module resolution hooks for admin API route tests.
// - Maps the Next.js-style `@/` alias to apps/admin.
// - Stubs `server-only` (provided by Next.js at build time, not installed here).
// - Redirects `@supabase/supabase-js` to the in-memory test double.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ADMIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: pathToFileURL(path.join(SUPPORT_DIR, 'server-only-stub.mjs')).href, shortCircuit: true };
  }
  if (specifier === '@supabase/supabase-js') {
    return { url: pathToFileURL(path.join(SUPPORT_DIR, 'fake-supabase.ts')).href, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    const base = path.join(ADMIN_ROOT, specifier.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, path.join(base, 'index.ts')]) {
      if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
