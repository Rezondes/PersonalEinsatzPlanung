import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { buildDefines } from './build/buildDefines';
import { aliases } from './build/aliases';
import { stripHtmlComments } from './build/stripHtmlComments';

// GitHub Pages serves this as a project site under /PersonalEinsatzPlanung/, not the domain
// root, so built asset URLs need that prefix. Only applied in CI (GITHUB_ACTIONS is set
// automatically by the Pages workflow) so local dev/build/preview stay at the root path.
// Any reference to a public/ asset from application code (not just index.html) must build its
// path from `import.meta.env.BASE_URL`, never a hardcoded root-relative string - see the
// "Never hardcode a root-relative path" gotcha in src/ui/CLAUDE.md for why (a real bug once).
//
// Hoisted into a constant because the service worker's scope and the manifest's id derive from it.
// Everything else in the manifest is written RELATIVE precisely so it does not have to.
const base = process.env.GITHUB_ACTIONS ? '/PersonalEinsatzPlanung/' : '/';

export default defineConfig({
  base,
  define: buildDefines(),
  plugins: [
    react(),
    VitePWA({
      // Never reload on its own. This is a data-entry tool: swapping the page out from under
      // someone mid-shift-dialog destroys what they were typing. UpdatePrompt.tsx asks first.
      registerType: 'prompt',
      // We register exclusively from ui/app/UpdatePrompt.tsx. Anything the plugin injects would be
      // a SECOND registration and would break the prompt flow; its 'inline' variant additionally
      // fails against a script-src without 'unsafe-inline'.
      injectRegister: null,
      // No includeAssets, and includeManifestIcons off: globPatterns below already walks dist/,
      // into which public/ is copied before Workbox runs, so it catches every icon by itself.
      // Left on, the plugin adds the manifest icons a second time - harmless only for as long as
      // both entries keep the same revision, and pure ballast in the meantime.
      includeManifestIcons: false,
      manifest: {
        // Resolved against the ORIGIN, so this one needs base - unlike everything below.
        id: base,
        name: 'Personaleinsatzplanung',
        // Not the full name: anything past ~12 characters is truncated under a home screen icon.
        short_name: 'Einsatzplan',
        description: 'Wochenplanung für Filialteams. Alle Daten bleiben lokal auf diesem Gerät.',
        lang: 'de',
        dir: 'ltr',
        // RELATIVE, never with a leading slash. Relative manifest paths resolve against the
        // manifest URL, so one string is correct under base '/' (local) AND under
        // '/PersonalEinsatzPlanung/' (GitHub Pages). A leading slash would resolve against the
        // origin and 404 in production - and it fails silently: the app still installs, just with
        // a blank icon and a start_url that goes nowhere.
        start_url: '.',
        scope: './',
        display: 'standalone',
        // White, because the app bar is white (AppShell.tsx). A dark green Android status bar
        // sitting directly on a white header reads as a rendering bug.
        theme_color: '#ffffff',
        // = palette.background.default from theme.ts, so Android's splash screen matches the app.
        background_color: '#f7f7f5',
        categories: ['business', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Its own source drawing with a safe zone; see public/icon-maskable.svg.
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // No webmanifest here: the plugin adds manifest.webmanifest to the precache itself, and a
        // duplicate URL makes Workbox throw add-to-cache-list-conflicting-entries at INSTALL time.
        // The service worker then never activates, and the build says nothing.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Both must stay false. 'prompt' works by leaving the new worker in "waiting"; either of
        // these set to true lets it take over on its own and turns our prompt into a lie.
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        // Insurance only. The hash router never produces a navigation URL other than base itself,
        // which the precache route already maps to index.html via directoryIndex.
        navigateFallback: 'index.html',
        // Vite already content-hashes everything under assets/; a second revision is dead weight.
        dontCacheBustURLsMatching: /assets\//,
        // DELIBERATELY no runtimeCaching. Without a matching route Workbox never calls
        // respondWith(), so accounts.google.com and googleapis.com go straight to the network,
        // untouched. Do not add caching for the Google script "for speed": the whole privacy
        // promise in PrivacyView rests on that script being fetched only after an explicit click.
      },
      // The production service worker would otherwise take over the dev server and make HMR look
      // broken in a thoroughly mystifying way.
      devOptions: { enabled: false },
    }),
    // Keeps the explanatory comments in index.html out of the shipped page; see the plugin.
    stripHtmlComments(),
  ],
  resolve: { alias: aliases(__dirname) },
});
