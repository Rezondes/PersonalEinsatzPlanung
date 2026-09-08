import { describe, it, expect, afterEach, vi } from 'vitest';
import { requestPersistentStorage, storageDurability, storageUsage } from './storagePersistence';

const original = Object.getOwnPropertyDescriptor(navigator, 'storage');

function stubStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, configurable: true });
}

afterEach(() => {
  if (original) {
    Object.defineProperty(navigator, 'storage', original);
  } else {
    // jsdom has no navigator.storage of its own, which is exactly the "unsupported" case.
    Reflect.deleteProperty(navigator, 'storage');
  }
});

describe('storageDurability', () => {
  it('reports unsupported where the browser has no storage manager, instead of throwing', async () => {
    Reflect.deleteProperty(navigator, 'storage');
    await expect(storageDurability()).resolves.toBe('unsupported');
  });

  it('distinguishes durable from evictable storage', async () => {
    stubStorage({ persisted: async () => true });
    await expect(storageDurability()).resolves.toBe('persistent');

    stubStorage({ persisted: async () => false });
    await expect(storageDurability()).resolves.toBe('best-effort');
  });

  it('treats a rejected query as unsupported rather than letting it escape', async () => {
    stubStorage({ persisted: () => Promise.reject(new Error('nope')) });
    await expect(storageDurability()).resolves.toBe('unsupported');
  });
});

describe('requestPersistentStorage', () => {
  it('reports what the browser decided', async () => {
    stubStorage({ persisted: async () => false, persist: async () => true });
    await expect(requestPersistentStorage()).resolves.toBe('persistent');

    stubStorage({ persisted: async () => false, persist: async () => false });
    await expect(requestPersistentStorage()).resolves.toBe('best-effort');
  });

  it('is never triggered by merely reading the state', async () => {
    const persist = vi.fn(async () => true);
    stubStorage({ persisted: async () => false, persist, estimate: async () => ({ usage: 1, quota: 2 }) });

    await storageDurability();
    await storageUsage();

    // Firefox shows a real permission dialog for persist(). One that appears unprompted gets
    // denied reflexively, and the denial is remembered - so reading must never request.
    expect(persist).not.toHaveBeenCalled();
  });
});

describe('storageUsage', () => {
  it('returns the figures the browser reports', async () => {
    stubStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 2048, quota: 1024 * 1024 }),
    });
    await expect(storageUsage()).resolves.toEqual({ usedBytes: 2048, quotaBytes: 1024 * 1024 });
  });

  it('returns null when the browser leaves a figure out', async () => {
    stubStorage({ persisted: async () => true, estimate: async () => ({ usage: 2048 }) });
    await expect(storageUsage()).resolves.toBeNull();
  });
});
