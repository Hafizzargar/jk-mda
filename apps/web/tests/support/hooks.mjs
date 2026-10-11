import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = path.join(WEB_ROOT, specifier.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, path.join(base, 'index.ts')]) {
      if (existsSync(candidate) && !candidate.endsWith(path.sep)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  if (specifier === 'next/server') {
    return { url: pathToFileURL(path.join(WEB_ROOT, 'tests', 'support', 'next-server-mock.mjs')).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL));
    const base = path.resolve(parentDir, specifier);
    for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.mjs`, path.join(base, 'index.ts')]) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  return nextResolve(specifier, context);
}
