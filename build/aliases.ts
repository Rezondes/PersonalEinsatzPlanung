import path from 'node:path';

/**
 * The four path aliases, shared by vite.config.ts and vitest.config.ts - the same reason
 * buildDefines.ts exists: two configs, one source, so they cannot drift apart. They were copied
 * by hand before, and vitest.config.ts is about to gain a fifth entry of its own (the stub for
 * the PWA virtual module), which is exactly when a hand-copied list starts diverging.
 *
 * rootDir is a parameter rather than a `__dirname` read inside this file on purpose: Vite bundles
 * config files before running them, so `__dirname` in here is not reliably the repository root.
 * Each config passes its own.
 */
export function aliases(rootDir: string): Record<string, string> {
  return {
    '@domain': path.resolve(rootDir, 'src/domain'),
    '@application': path.resolve(rootDir, 'src/application'),
    '@infrastructure': path.resolve(rootDir, 'src/infrastructure'),
    '@ui': path.resolve(rootDir, 'src/ui'),
  };
}
