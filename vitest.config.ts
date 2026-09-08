import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { buildDefines } from './build/buildDefines';
import { aliases } from './build/aliases';

export default defineConfig({
  define: buildDefines(),
  plugins: [react()],
  resolve: {
    alias: {
      ...aliases(__dirname),
      // vite-plugin-pwa's virtual module only exists while that plugin runs, i.e. never here.
      // Without this entry any test rendering the app shell fails to resolve the import.
      'virtual:pwa-register/react': path.resolve(__dirname, 'src/testStubs/pwaRegisterReact.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.ts'],
    globals: true,
  },
});
