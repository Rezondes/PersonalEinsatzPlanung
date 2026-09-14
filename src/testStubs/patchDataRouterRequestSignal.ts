/**
 * Import this FIRST, before anything that touches react-router's data router (createHashRouter /
 * createMemoryRouter), in any test file that does. ESM evaluates each import fully before the
 * next, so importing this ahead of e.g. `./router` guarantees the patch is applied before
 * router.tsx's own module-level `createHashRouter(routes)` call runs - reordering this file's own
 * top-level statements around a later import would NOT work, since all of a module's imports are
 * evaluated before any of its own body regardless of source order.
 *
 * Why this exists: react-router's data router builds a real `Request` for every loader call. In
 * this Vite/Vitest/jsdom/Node combination, jsdom's own AbortSignal (from `new AbortController()`)
 * fails a strict brand-check inside the bundled Request class Vite provides here, throwing on the
 * very first navigation - a jsdom/Node fetch-internals mismatch, unrelated to anything this app's
 * loaders do. Stripping `signal` before it reaches that check sidesteps it with no effect on what
 * such tests actually exercise: this app's loaders (localeLoader, the bare-root redirect) are
 * synchronous and never use cancellation.
 */
const OriginalRequest = globalThis.Request;

class PatchedRequest extends OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init && 'signal' in init) {
      const rest = { ...init };
      delete rest.signal;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
}

globalThis.Request = PatchedRequest as unknown as typeof Request;
