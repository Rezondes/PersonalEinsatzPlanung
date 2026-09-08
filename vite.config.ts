import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // GitHub Pages serves this as a project site under /PersonalEinsatzPlanung/, not the domain
  // root, so built asset URLs need that prefix. Only applied in CI (GITHUB_ACTIONS is set
  // automatically by the Pages workflow) so local dev/build/preview stay at the root path.
  // Any reference to a public/ asset from application code (not just index.html) must build its
  // path from `import.meta.env.BASE_URL`, never a hardcoded root-relative string - see the
  // "Never hardcode a root-relative path" gotcha in src/ui/CLAUDE.md for why (a real bug once).
  base: process.env.GITHUB_ACTIONS ? '/PersonalEinsatzPlanung/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
});
