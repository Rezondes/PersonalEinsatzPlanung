/**
 * The build data Vite stamps into the bundle. Shared by vite.config.ts and vitest.config.ts so the
 * two can never drift apart - without it in the test config, importing src/ui/app/buildInfo.ts
 * would throw "__APP_BUILD_TIME__ is not defined".
 *
 * Only RAW data is injected; the formatting lives in src/ui/app/buildInfo.ts where Vitest reaches
 * it. A new constant here also has to be declared in src/vite-env.d.ts (tsc runs before Vite in
 * `npm run build`) and listed in .eslintrc.cjs under globals (no-undef).
 */
export function buildDefines(): Record<string, string> {
  return {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    // GitHub Actions sets both of these by itself; locally they stay empty/false.
    __APP_COMMIT__: JSON.stringify((process.env.GITHUB_SHA ?? '').slice(0, 7)),
    __APP_IS_CI__: JSON.stringify(Boolean(process.env.GITHUB_ACTIONS)),
  };
}
