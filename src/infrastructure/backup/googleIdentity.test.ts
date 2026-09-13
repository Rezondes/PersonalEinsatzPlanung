import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

interface FakeTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

/** Captures the callback/error_callback passed to initTokenClient so a test can fire them itself,
 * simulating what the real Google Identity Services script would do asynchronously. */
function installFakeGoogle() {
  let lastConfig: {
    callback: (response: { access_token?: string }) => void;
    error_callback?: (error: { type?: string }) => void;
  } | null = null;
  const initTokenClient = vi.fn((config: NonNullable<typeof lastConfig>) => {
    lastConfig = config;
    const client: FakeTokenClient = { requestAccessToken: () => {} };
    return client;
  });
  window.google = { accounts: { oauth2: { initTokenClient, revoke: vi.fn() } } };
  return {
    initTokenClient,
    fireSuccess: (token: string) => lastConfig?.callback({ access_token: token }),
    fireError: (type?: string) => lastConfig?.error_callback?.({ type }),
  };
}

/** googleIdentity.ts lazily creates a <script> and resolves once its onload fires - installing a
 * fake element up front lets a test drive that load sequence deterministically instead of touching
 * the real network. */
function installFakeScriptElement() {
  const script: { onload: (() => void) | null; onerror: (() => void) | null } = { onload: null, onerror: null };
  vi.spyOn(document, 'createElement').mockReturnValue(script as unknown as HTMLScriptElement);
  vi.spyOn(document.head, 'appendChild').mockImplementation((node) => node);
  return script;
}

/** googleIdentity.ts keeps module-level state (the cached script promise, the in-memory token) that
 * several of these tests deliberately drive into a specific shape - vi.resetModules() plus a fresh
 * dynamic import gives every test its own clean instance instead of leaking state between tests. */
async function freshModule() {
  vi.resetModules();
  return import('./googleIdentity');
}

beforeEach(() => {
  delete (window as { google?: unknown }).google;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('requestAccessToken timeout (M1)', () => {
  it('rejects if no GIS callback ever fires, instead of hanging forever', async () => {
    vi.useFakeTimers();
    const { requestAccessToken } = await freshModule();
    const script = installFakeScriptElement();
    installFakeGoogle();

    const promise = requestAccessToken(false);
    script.onload?.();
    await vi.advanceTimersByTimeAsync(0); // let loadGoogleIdentity's promise settle

    const assertion = expect(promise).rejects.toThrow(/Google/);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });
});

describe('requestAccessToken in-flight de-duplication (M1)', () => {
  it('shares one token client between two concurrent calls with the same silent flag', async () => {
    const { requestAccessToken } = await freshModule();
    const script = installFakeScriptElement();
    const google = installFakeGoogle();

    const first = requestAccessToken(true);
    const second = requestAccessToken(true);
    script.onload?.();
    await Promise.resolve(); // let loadGoogleIdentity's .then() run
    await Promise.resolve();
    google.fireSuccess('token-shared');

    await expect(first).resolves.toBe('token-shared');
    await expect(second).resolves.toBe('token-shared');
    expect(google.initTokenClient).toHaveBeenCalledTimes(1);
  });
});

describe('script load failure resets the cached promise so a later call can retry (M2)', () => {
  it('resets after onload fires but window.google never appeared', async () => {
    const { requestAccessToken } = await freshModule();
    const scriptAttempt1 = installFakeScriptElement();

    const first = requestAccessToken(false);
    scriptAttempt1.onload?.(); // fires with window.google still undefined
    await expect(first).rejects.toThrow('Google-Anmeldung konnte nicht geladen werden.');

    // A stale cached scriptPromise from attempt 1 would make this second attempt reuse the same
    // (already-settled, rejected) promise and fail immediately without ever creating a new script.
    const scriptAttempt2 = installFakeScriptElement();
    const google = installFakeGoogle();
    const second = requestAccessToken(false);
    scriptAttempt2.onload?.();
    await Promise.resolve();
    await Promise.resolve();
    google.fireSuccess('token-after-retry');

    await expect(second).resolves.toBe('token-after-retry');
  });
});

describe('forgetAccessToken revocation (N9)', () => {
  it('clears the token and calls the real REST revoke endpoint with a real HTTP status', async () => {
    const { requestAccessToken, forgetAccessToken, currentAccessToken } = await freshModule();
    const script = installFakeScriptElement();
    const google = installFakeGoogle();
    const signIn = requestAccessToken(false);
    script.onload?.();
    await Promise.resolve();
    await Promise.resolve();
    google.fireSuccess('token-to-revoke');
    await signIn;
    expect(currentAccessToken()).toBe('token-to-revoke');

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await forgetAccessToken();

    expect(result).toBe(true);
    expect(currentAccessToken()).toBeNull();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('oauth2.googleapis.com/revoke');
    expect(url).toContain('token-to-revoke');
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('still clears the local token even when the revoke request fails, but reports it as unconfirmed', async () => {
    const { requestAccessToken, forgetAccessToken, currentAccessToken } = await freshModule();
    const script = installFakeScriptElement();
    const google = installFakeGoogle();
    const signIn = requestAccessToken(false);
    script.onload?.();
    await Promise.resolve();
    await Promise.resolve();
    google.fireSuccess('token-2');
    await signIn;

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await forgetAccessToken();

    expect(result).toBe(false);
    expect(currentAccessToken()).toBeNull();
  });

  it('resolves true without making a request when there was no token to begin with', async () => {
    const { forgetAccessToken } = await freshModule();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(forgetAccessToken()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
