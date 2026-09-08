/**
 * Whether the browser promises to keep this app's data, or may evict it when space runs short.
 *
 * This matters more here than in most apps: the IndexedDB next door in db.ts holds the ONLY copy
 * of a store's schedules. Without durable storage a browser is free to throw it away, and Safari
 * clears script-writable storage of ordinary websites after seven days without a visit. An
 * installed app on the home screen is exempt and gets durability granted, which is why the
 * Einstellungen page pushes installation on iPhone and iPad.
 *
 * 'best-effort' is the default state and not an error: Chrome upgrades it on its own once the app
 * is installed or sufficiently used.
 */
export type StorageDurability = 'persistent' | 'best-effort' | 'unsupported';

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
}

/** jsdom has no navigator.storage at all, and neither do older browsers. */
function storageManager(): StorageManager | null {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.persisted === 'function'
    ? navigator.storage
    : null;
}

/** Reads the current state. Never asks the user anything - see requestPersistentStorage. */
export async function storageDurability(): Promise<StorageDurability> {
  const storage = storageManager();
  if (!storage) {
    return 'unsupported';
  }
  try {
    return (await storage.persisted()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

/**
 * Asks for durable storage. Deliberately NOT called on start-up: Firefox shows a real permission
 * prompt for this, and a dialog appearing out of nowhere gets a reflexive "Block" - which Firefox
 * then remembers for good, forfeiting exactly the durability we wanted. It is called from a button
 * the user pressed, and once on installation, where the context is obvious.
 */
export async function requestPersistentStorage(): Promise<StorageDurability> {
  const storage = storageManager();
  if (!storage || typeof storage.persist !== 'function') {
    return 'unsupported';
  }
  try {
    return (await storage.persist()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}

/** How much the app occupies, for the Einstellungen page. null when the browser will not say. */
export async function storageUsage(): Promise<StorageUsage | null> {
  const storage = storageManager();
  if (!storage || typeof storage.estimate !== 'function') {
    return null;
  }
  try {
    const { usage, quota } = await storage.estimate();
    return usage === undefined || quota === undefined ? null : { usedBytes: usage, quotaBytes: quota };
  } catch {
    return null;
  }
}
