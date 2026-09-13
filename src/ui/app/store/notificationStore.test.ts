import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore, notify } from './notificationStore';

beforeEach(() => {
  // The store is a module singleton and would otherwise leak a queued notification between tests.
  useNotificationStore.getState().clear();
});

describe('useNotificationStore', () => {
  it('starts with an empty queue', () => {
    expect(useNotificationStore.getState().queue).toEqual([]);
  });

  it('notifySuccess/notifyError push onto the queue with the right severity and text', () => {
    useNotificationStore.getState().notifySuccess('Filiale wurde gespeichert.');
    useNotificationStore.getState().notifyError('Speichern fehlgeschlagen.');

    const { queue } = useNotificationStore.getState();
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({ severity: 'success', text: 'Filiale wurde gespeichert.' });
    expect(queue[1]).toMatchObject({ severity: 'error', text: 'Speichern fehlgeschlagen.' });
  });

  it('assigns each notification a distinct, increasing id', () => {
    useNotificationStore.getState().notifySuccess('erste');
    useNotificationStore.getState().notifySuccess('zweite');

    const [first, second] = useNotificationStore.getState().queue;
    expect(second.id).toBe(first.id + 1);
  });

  it('dismiss() removes only the front of the queue (the one currently on screen)', () => {
    useNotificationStore.getState().notifySuccess('eins');
    useNotificationStore.getState().notifySuccess('zwei');

    useNotificationStore.getState().dismiss();

    expect(useNotificationStore.getState().queue.map((n) => n.text)).toEqual(['zwei']);
  });

  it('drops the oldest QUEUED notification, never the one on screen, once more than MAX_QUEUED are waiting', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((text) => useNotificationStore.getState().notifySuccess(text));

    // 'a' is on screen (queue[0], never dropped); MAX_QUEUED=3 means only 3 more may wait, so the
    // oldest QUEUED one ('b') is dropped, not the visible one and not the newest arrivals.
    expect(useNotificationStore.getState().queue.map((n) => n.text)).toEqual(['a', 'c', 'd', 'e']);
  });

  it('does not drop anything while at or below the MAX_QUEUED limit', () => {
    ['a', 'b', 'c', 'd'].forEach((text) => useNotificationStore.getState().notifySuccess(text));
    expect(useNotificationStore.getState().queue.map((n) => n.text)).toEqual(['a', 'b', 'c', 'd']);
  });

  describe('reportError', () => {
    it('uses an Error instance\'s own message, optionally prefixed with a context string', () => {
      useNotificationStore.getState().reportError(new Error('IndexedDB nicht verfügbar'));
      expect(useNotificationStore.getState().queue[0]).toMatchObject({
        severity: 'error',
        text: 'IndexedDB nicht verfügbar',
      });

      useNotificationStore.getState().clear();
      useNotificationStore.getState().reportError(new Error('IndexedDB nicht verfügbar'), 'Speichern fehlgeschlagen');
      expect(useNotificationStore.getState().queue[0]?.text).toBe('Speichern fehlgeschlagen: IndexedDB nicht verfügbar');
    });

    it('falls back to a generic German message for a non-Error thrown value', () => {
      useNotificationStore.getState().reportError('a plain string, not an Error');
      expect(useNotificationStore.getState().queue[0]?.text).toBe('Unbekannter Fehler.');
    });
  });

  describe('notify (the non-hook helper for call sites outside React)', () => {
    it('notify.success/notify.error/notify.report route to the same store the hook reads', () => {
      notify.success('Erfolg');
      notify.error('Fehler');
      notify.report(new Error('kaputt'), 'Kontext');

      const texts = useNotificationStore.getState().queue.map((n) => n.text);
      expect(texts).toEqual(['Erfolg', 'Fehler', 'Kontext: kaputt']);
    });
  });
});
