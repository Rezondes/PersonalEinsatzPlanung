import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { buildDefines } from './build/buildDefines';

export default defineConfig({
  define: buildDefines(),
  plugins: [react()],
  resolve: {
    alias: {
      '@domain': path.resolve(__dirname, 'src/domain'),
      '@application': path.resolve(__dirname, 'src/application'),
      '@infrastructure': path.resolve(__dirname, 'src/infrastructure'),
      '@ui': path.resolve(__dirname, 'src/ui'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.ts'],
    globals: true,
  },
});
