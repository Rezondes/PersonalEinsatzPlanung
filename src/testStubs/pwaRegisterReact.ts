import { useState } from 'react';

/**
 * Stand-in for `virtual:pwa-register/react` under Vitest, wired up in vitest.config.ts.
 *
 * The real module only exists while vite-plugin-pwa is running, so without this every test that
 * renders the app shell would fail to resolve the import. Typing it against the real declaration
 * means the stub cannot silently drift from the module it replaces.
 *
 * It reports "no update pending", which is the state the app is in for all but a few seconds of
 * its life. A test that needs the other state mocks this module directly.
 */
export const useRegisterSW: typeof import('virtual:pwa-register/react').useRegisterSW = () => ({
  offlineReady: useState(false),
  needRefresh: useState(false),
  updateServiceWorker: async () => {},
});
