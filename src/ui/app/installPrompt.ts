/**
 * Captures the browser's install offer, so the app can put an "App installieren" button where the
 * user will look for it instead of relying on a menu entry buried in the browser.
 *
 * The capture happens at MODULE level, not in an effect: Chrome fires beforeinstallprompt while
 * the page loads, long before the Einstellungen page mounts, and the event is gone by then. App.tsx
 * imports this module so it is evaluated during start-up.
 */

/** Not in lib.dom - declared here the same way googleIdentity.ts declares its Google shape. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppresses Chrome's own mini info bar; we offer installation ourselves, in context.
    e.preventDefault();
    deferredEvent = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    // The offer can only be used once, and it is spent now.
    deferredEvent = null;
    notify();
  });
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function canInstall(): boolean {
  return deferredEvent !== null;
}

/** Returns true when the user actually accepted. The offer is spent either way. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredEvent;
  if (!event) {
    return false;
  }
  deferredEvent = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

/** True when running from the home screen rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  // matchMedia is missing in jsdom, and an unguarded call would take the settings tests down.
  const byDisplayMode =
    typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  // iOS never matches the media query; it has its own flag.
  const byIosFlag = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return byDisplayMode || byIosFlag;
}

/**
 * True on Safari/iOS, where beforeinstallprompt does not exist and installation is a manual
 * "Teilen -> Zum Home-Bildschirm". A feature check rather than user-agent sniffing: only WebKit
 * defines navigator.standalone, and it survives iPadOS's desktop-browser masquerade.
 */
export function isManualInstallPlatform(): boolean {
  return typeof window !== 'undefined' && 'standalone' in window.navigator;
}
