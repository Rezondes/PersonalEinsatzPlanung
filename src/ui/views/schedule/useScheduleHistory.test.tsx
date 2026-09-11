import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor, render, screen } from '@testing-library/react';
import type { BranchId } from '@domain/shared/ids';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { useScheduleHistory } from './useScheduleHistory';
import type { HistoryStep, HistoryDirection } from './useScheduleHistory';

// Mirrors the source's own private MAX_STEPS - not exported, so re-declared here for the eviction test.
const MAX_STEPS = 50;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const branchId = 'b1' as BranchId;

function schedule(overrides: Partial<WeeklySchedule> = {}): WeeklySchedule {
  return { ...createWeeklySchedule(branchId, { year: 2026, week: 37 }, []), ...overrides };
}

// `marker` is stamped onto plannedWeeklyRevenue purely so a test can tell steps apart later
// (e.g. via applyStep's call order) - it carries no business meaning here.
function makeStep(marker = 0): HistoryStep {
  return {
    scheduleBefore: schedule(),
    scheduleAfter: schedule({ plannedWeeklyRevenue: marker }),
    absenceOps: [],
  };
}

function renderHistory(
  overrides: {
    historyKey?: string;
    shortcutsEnabled?: boolean;
    applyStep?: (step: HistoryStep, direction: HistoryDirection) => Promise<void>;
    onError?: (e: unknown, context?: string) => void;
  } = {},
) {
  const applyStep = overrides.applyStep ?? vi.fn().mockResolvedValue(undefined);
  const onError = overrides.onError ?? vi.fn();
  const shortcutsEnabled = overrides.shortcutsEnabled ?? false;
  const rendered = renderHook(
    ({ historyKey }: { historyKey: string }) => useScheduleHistory({ historyKey, shortcutsEnabled, applyStep, onError }),
    { initialProps: { historyKey: overrides.historyKey ?? 'b1|2026|37' } },
  );
  return { ...rendered, applyStep, onError };
}

describe('useScheduleHistory', () => {
  describe('run', () => {
    it('invokes mutate and sets canUndo true once it resolves with a step', async () => {
      const mutate = vi.fn().mockResolvedValue(makeStep(1));
      const { result } = renderHistory();

      expect(result.current.canUndo).toBe(false);

      await act(async () => {
        await result.current.run(mutate, 'ctx');
      });

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(result.current.canUndo).toBe(true);
    });

    it('is busy while mutate is in flight and not busy once it settles', async () => {
      const deferred = createDeferred<HistoryStep | null>();
      const mutate = vi.fn(() => deferred.promise);
      const { result } = renderHistory();

      let task!: Promise<void>;
      act(() => {
        task = result.current.run(mutate, 'ctx');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.canUndo).toBe(false);

      await act(async () => {
        deferred.resolve(makeStep(1));
        await task;
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it('leaves canUndo false and records nothing when mutate resolves null', async () => {
      const mutate = vi.fn().mockResolvedValue(null);
      const onError = vi.fn();
      const { result } = renderHistory({ onError });

      await act(async () => {
        await result.current.run(mutate, 'ctx');
      });

      expect(result.current.canUndo).toBe(false);
      expect(onError).not.toHaveBeenCalled();
    });

    it('calls onError with the given context and records nothing when mutate rejects', async () => {
      const error = new Error('boom');
      const mutate = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();
      const { result } = renderHistory({ onError });

      await act(async () => {
        await result.current.run(mutate, 'Speichern fehlgeschlagen');
      });

      expect(onError).toHaveBeenCalledWith(error, 'Speichern fehlgeschlagen');
      expect(result.current.canUndo).toBe(false);
      expect(result.current.busy).toBe(false);
    });

    it('serializes two run() calls so the second mutate only starts once the first has settled', async () => {
      // Regression-shaped test for the write queue described in the source's own comment: without
      // it, two quick edits would both call mutate() immediately off the same pre-edit closure.
      // mutateB must not be called before deferredA resolves - it is blocked purely by the queue,
      // not by timing, so this assertion cannot be flaky.
      const deferredA = createDeferred<HistoryStep | null>();
      const deferredB = createDeferred<HistoryStep | null>();
      const mutateA = vi.fn(() => deferredA.promise);
      const mutateB = vi.fn(() => deferredB.promise);
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ applyStep });

      let taskA!: Promise<void>;
      let taskB!: Promise<void>;
      act(() => {
        taskA = result.current.run(mutateA, 'ctx-a');
        taskB = result.current.run(mutateB, 'ctx-b');
      });

      await waitFor(() => expect(mutateA).toHaveBeenCalledTimes(1));
      expect(mutateB).not.toHaveBeenCalled();

      await act(async () => {
        deferredA.resolve(makeStep(1));
        await taskA;
      });
      await waitFor(() => expect(mutateB).toHaveBeenCalledTimes(1));

      await act(async () => {
        deferredB.resolve(makeStep(2));
        await taskB;
      });

      await waitFor(() => expect(result.current.canUndo).toBe(true));

      // Both steps landed, in call order (A before B), rather than one clobbering the other.
      await act(async () => {
        await result.current.undo();
      });
      await act(async () => {
        await result.current.undo();
      });

      expect(applyStep.mock.calls.map(([step]) => (step as HistoryStep).scheduleAfter.plannedWeeklyRevenue)).toEqual([
        2, 1,
      ]);
    });
  });

  describe('record', () => {
    it('adds a step directly onto the past stack, bypassing mutate', () => {
      const { result } = renderHistory();

      act(() => {
        result.current.record(makeStep(1));
      });

      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });
  });

  describe('undo/redo', () => {
    it('undo() pops the top past step, applies it, and moves it to the future stack', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(applyStep).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleAfter: expect.objectContaining({ plannedWeeklyRevenue: 1 }) }),
        'undo',
      );
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });

    it('redo() pops the top future step, applies it, and moves it back to the past stack', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });
      await act(async () => {
        await result.current.undo();
      });
      applyStep.mockClear();

      await act(async () => {
        await result.current.redo();
      });

      expect(applyStep).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleAfter: expect.objectContaining({ plannedWeeklyRevenue: 1 }) }),
        'redo',
      );
      expect(result.current.canRedo).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it('undo() resolves without calling applyStep when the past stack is empty', async () => {
      const applyStep = vi.fn();
      const { result } = renderHistory({ applyStep });

      await act(async () => {
        await result.current.undo();
      });

      expect(applyStep).not.toHaveBeenCalled();
      expect(result.current.busy).toBe(false);
    });

    it('redo() resolves without calling applyStep when the future stack is empty', async () => {
      const applyStep = vi.fn();
      const { result } = renderHistory({ applyStep });

      await act(async () => {
        await result.current.redo();
      });

      expect(applyStep).not.toHaveBeenCalled();
      expect(result.current.busy).toBe(false);
    });

    it('a failing undo() reports "Rückgängig fehlgeschlagen" and leaves the step on the past stack', async () => {
      const error = new Error('boom');
      const applyStep = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();
      const { result } = renderHistory({ applyStep, onError });

      act(() => {
        result.current.record(makeStep(1));
      });

      await act(async () => {
        await result.current.undo();
      });

      expect(onError).toHaveBeenCalledWith(error, 'Rückgängig fehlgeschlagen');
      // Not moved: still undoable, and nothing landed on the future stack.
      expect(result.current.canUndo).toBe(true);
      expect(result.current.canRedo).toBe(false);
    });

    it('a failing redo() reports "Wiederholen fehlgeschlagen" and leaves the step on the future stack', async () => {
      const error = new Error('boom');
      let shouldFail = false;
      const applyStep = vi.fn(() => (shouldFail ? Promise.reject(error) : Promise.resolve(undefined)));
      const onError = vi.fn();
      const { result } = renderHistory({ applyStep, onError });

      act(() => {
        result.current.record(makeStep(1));
      });
      await act(async () => {
        await result.current.undo();
      });
      shouldFail = true;

      await act(async () => {
        await result.current.redo();
      });

      expect(onError).toHaveBeenCalledWith(error, 'Wiederholen fehlgeschlagen');
      // Not moved back: still redoable, and it did not return to the past stack.
      expect(result.current.canRedo).toBe(true);
      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('busy suppresses canUndo/canRedo', () => {
    // Both canUndo and canRedo are `stack.length > 0 && !busy`. Every other test in this file
    // only ever observes `busy` while its own stack is still empty, so the `&& !busy` half would
    // go completely unexercised - and every other test would keep passing - without these two:
    // dropping it lets a queued run() report a stack as usable while its write is still in flight.
    it('reports canUndo false while a run() is in flight even though the past stack already has a step', async () => {
      const deferred = createDeferred<HistoryStep | null>();
      const mutate = vi.fn(() => deferred.promise);
      const { result } = renderHistory();

      act(() => {
        result.current.record(makeStep(1));
      });
      expect(result.current.canUndo).toBe(true);

      let task!: Promise<void>;
      act(() => {
        task = result.current.run(mutate, 'ctx');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.canUndo).toBe(false);

      await act(async () => {
        deferred.resolve(makeStep(2));
        await task;
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.canUndo).toBe(true);
    });

    it('reports canRedo false while a run() is in flight even though the future stack already has a step', async () => {
      const deferred = createDeferred<HistoryStep | null>();
      const mutate = vi.fn(() => deferred.promise);
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });
      await act(async () => {
        await result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      let task!: Promise<void>;
      act(() => {
        task = result.current.run(mutate, 'ctx');
      });

      expect(result.current.busy).toBe(true);
      expect(result.current.canRedo).toBe(false);

      // Resolves with null (nothing to record) so the future stack is untouched by this run() -
      // otherwise a truthy step would legitimately clear it and confound the assertion below.
      await act(async () => {
        deferred.resolve(null);
        await task;
      });

      expect(result.current.busy).toBe(false);
      expect(result.current.canRedo).toBe(true);
    });
  });

  describe('historyKey', () => {
    it('clears both stacks when historyKey changes', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result, rerender } = renderHistory({ applyStep, historyKey: 'b1|2026|37' });

      act(() => {
        result.current.record(makeStep(1));
      });
      await act(async () => {
        await result.current.undo();
      });
      expect(result.current.canRedo).toBe(true);

      rerender({ historyKey: 'b1|2026|38' });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('drops a step whose run() resolves after historyKey has already changed', async () => {
      const deferred = createDeferred<HistoryStep | null>();
      const mutate = vi.fn(() => deferred.promise);
      const { result, rerender } = renderHistory({ historyKey: 'b1|2026|37' });

      let task!: Promise<void>;
      act(() => {
        task = result.current.run(mutate, 'ctx');
      });

      rerender({ historyKey: 'b1|2026|38' });

      await act(async () => {
        deferred.resolve(makeStep(1));
        await task;
      });

      expect(result.current.canUndo).toBe(false);
    });
  });

  describe('keyboard shortcuts', () => {
    it('Strg+Z triggers undo when shortcuts are enabled', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ shortcutsEnabled: true, applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });

      await waitFor(() => expect(applyStep).toHaveBeenCalledTimes(1));
      expect(applyStep.mock.calls[0]?.[1]).toBe('undo');
    });

    it('Strg+Umschalt+Z triggers redo', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ shortcutsEnabled: true, applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });
      await act(async () => {
        await result.current.undo();
      });
      applyStep.mockClear();

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }),
        );
      });

      await waitFor(() => expect(applyStep).toHaveBeenCalledTimes(1));
      expect(applyStep.mock.calls[0]?.[1]).toBe('redo');
    });

    it('Strg+Y also triggers redo', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ shortcutsEnabled: true, applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });
      await act(async () => {
        await result.current.undo();
      });
      applyStep.mockClear();

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
      });

      await waitFor(() => expect(applyStep).toHaveBeenCalledTimes(1));
      expect(applyStep.mock.calls[0]?.[1]).toBe('redo');
    });

    it('does nothing when shortcutsEnabled is false', () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ shortcutsEnabled: false, applyStep });

      act(() => {
        result.current.record(makeStep(1));
      });

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });

      expect(applyStep).not.toHaveBeenCalled();
      expect(result.current.canUndo).toBe(true);
    });

    it('does not trigger undo when the keydown target is a focused input', () => {
      function InputHarness(props: {
        applyStep: (step: HistoryStep, direction: HistoryDirection) => Promise<void>;
        onReady: (api: ReturnType<typeof useScheduleHistory>) => void;
      }) {
        const history = useScheduleHistory({
          historyKey: 'b1|2026|37',
          shortcutsEnabled: true,
          applyStep: props.applyStep,
          onError: vi.fn(),
        });
        props.onReady(history);
        return <input aria-label="host-input" />;
      }

      const applyStep = vi.fn().mockResolvedValue(undefined);
      let api!: ReturnType<typeof useScheduleHistory>;
      render(<InputHarness applyStep={applyStep} onReady={(h) => (api = h)} />);

      act(() => {
        api.record(makeStep(1));
      });

      const input = screen.getByLabelText('host-input');
      input.focus();
      act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      });

      expect(applyStep).not.toHaveBeenCalled();
      expect(api.canUndo).toBe(true);
    });
  });

  describe('MAX_STEPS', () => {
    it('keeps only the most recent 50 steps, evicting the oldest', async () => {
      const applyStep = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHistory({ applyStep });

      for (let i = 0; i <= MAX_STEPS; i++) {
        await act(async () => {
          await result.current.run(() => Promise.resolve(makeStep(i)), 'ctx');
        });
      }

      expect(result.current.canUndo).toBe(true);

      for (let i = 0; i < MAX_STEPS; i++) {
        await act(async () => {
          await result.current.undo();
        });
      }

      expect(result.current.canUndo).toBe(false);
      const markers = applyStep.mock.calls.map(([step]) => (step as HistoryStep).scheduleAfter.plannedWeeklyRevenue);
      // Most recent first (LIFO): markers 50..1 - marker 0 (the 51st-from-last, i.e. the very
      // first pushed) was evicted by the .slice(-MAX_STEPS) and must never appear.
      expect(markers).toEqual(Array.from({ length: MAX_STEPS }, (_, i) => MAX_STEPS - i));
      expect(markers).not.toContain(0);
    });
  });
});
