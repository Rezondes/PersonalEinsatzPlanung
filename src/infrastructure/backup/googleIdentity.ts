import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPE } from './googleConfig';

/** Minimal shape of the bits of Google Identity Services this app uses, so no extra type package
 * is needed for four fields. */
interface TokenResponse {
  access_token?: string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** Remembers only THAT the user once connected Drive, never the token itself. Lets the app renew a
 * token silently after a reload instead of asking again, while a stolen localStorage still yields
 * nothing but the boolean. */
const CONNECTED_FLAG = 'pep.drive.connected';

let scriptPromise: Promise<GoogleIdentity> | null = null;
// Deliberately memory only, never localStorage: a stored token would be readable by any XSS and is
// good for an hour of Drive access. The price is a fresh authorisation after a page reload.
let accessToken: string | null = null;

/**
 * Loads the Google script - but only when this is first called, i.e. when the user actually clicks
 * "Mit Google anmelden". Until then the app makes no request to Google at all, which is what keeps
 * the privacy statement true for everyone who does not use this feature.
 */
function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google) {
      resolve(window.google);
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      if (window.google) {
        resolve(window.google);
      } else {
        reject(new Error('Google-Anmeldung konnte nicht geladen werden.'));
      }
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Google-Anmeldung konnte nicht geladen werden. Besteht eine Internetverbindung?'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function currentAccessToken(): string | null {
  return accessToken;
}

export function wasConnected(): boolean {
  try {
    return localStorage.getItem(CONNECTED_FLAG) === '1';
  } catch {
    // Private mode or blocked site data: just behave like a first-time visitor.
    return false;
  }
}

function rememberConnected(connected: boolean): void {
  try {
    if (connected) {
      localStorage.setItem(CONNECTED_FLAG, '1');
    } else {
      localStorage.removeItem(CONNECTED_FLAG);
    }
  } catch {
    // Nothing to do - the feature still works, it just asks again after a reload.
  }
}

/** Drops the in-memory token without revoking anything and without forgetting that the user is a
 * Drive user. For the case where Google refused to renew: the app is signed out, but the button
 * that signs back in stays where the user expects it. */
export function clearAccessToken(): void {
  accessToken = null;
}

export function forgetAccessToken(): void {
  const token = accessToken;
  accessToken = null;
  rememberConnected(false);
  if (token && window.google) {
    window.google.accounts.oauth2.revoke(token);
  }
}

/**
 * Asks Google for an access token. With `silent` the browser only renews an existing consent
 * without showing anything, which is what the retry after an expired token uses; without it the
 * user sees the Google dialog.
 */
export function requestAccessToken(silent: boolean): Promise<string> {
  return loadGoogleIdentity().then(
    (google) =>
      new Promise<string>((resolve, reject) => {
        // A fresh client per call: the callback is what resolves this very promise.
        const client = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: GOOGLE_DRIVE_SCOPE,
          callback: (response) => {
            if (response.access_token) {
              accessToken = response.access_token;
              rememberConnected(true);
              resolve(response.access_token);
            } else {
              reject(new Error('Google hat keinen Zugriff erteilt.'));
            }
          },
          error_callback: (error) => {
            if (error.type === 'popup_closed') {
              reject(new Error('Die Anmeldung wurde abgebrochen.'));
            } else if (error.type === 'popup_failed_to_open') {
              reject(new Error('Das Anmeldefenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.'));
            } else {
              reject(new Error('Die Anmeldung bei Google ist fehlgeschlagen.'));
            }
          },
        });
        client.requestAccessToken(silent ? { prompt: 'none' } : undefined);
      }),
  );
}
