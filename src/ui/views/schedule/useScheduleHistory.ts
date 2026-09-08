import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Absence } from '@domain/absence/Absence';

/** What one edit did to the Absence aggregate. Deliberately operations rather than a snapshot of
 * the absence list: useAbsences loads every absence of the branch, for every week and year, so
 * diffing two snapshots would let an undo in the Wochenplanung delete an unrelated absence that was
 * edited in the Abwesenheiten tab meanwhile. Every edit here touches at most one delete plus one
 * create, so two operations always suffice. */
export type AbsenceOp =
  | { kind: 'created'; absence: Absence }
  | { kind: 'deleted'; absence: Absence };

export interface HistoryStep {
  scheduleBefore: WeeklySchedule;
  scheduleAfter: WeeklySchedule;
  absenceOps: AbsenceOp[];
}

export type HistoryDirection = 'undo' | 'redo';

interface KeyedStep extends HistoryStep {
  /** Branch + calendar week the step belongs to, so a step can never be replayed into another week. */
  key: string;
}

interface UseScheduleHistoryOptions {
  /** Identifies the currently displayed week, e.g. "<branchId>|2026|10". Changing it clears the
   * stacks: the schedule is refetched for the new week and old steps no longer apply. */
  historyKey: string;
  /** False while a dialog or the context menu is open, so Strg+Z belongs to the text field there. */
  shortcutsEnabled: boolean;
  applyStep: (step: HistoryStep, direction: HistoryDirection) => Promise<void>;
  onError: (e: unknown, context?: string) => void;
}

const MAX_STEPS = 50;

/**
 * Undo/redo for the weekly planning view, plus the write queue every edit goes through.
 *
 * The queue matters as much as the stacks: the view autosaves on every change with no save button,
 * and the handlers used to read the schedule from their render closure, so two quick edits could
 * both start from the same pre-edit value and lose the first write. Serializing them and reading
 * the current aggregate at execution time removes that, and it also guarantees an undo can never
 * interleave with a save that is still in flight.
 */
export function useScheduleHistory({
  historyKey,
  shortcutsEnabled,
  applyStep,
  onError,
}: UseScheduleHistoryOptions) {
  const pastRef = useRef<KeyedStep[]>([]);
  const futureRef = useRef<KeyedStep[]>([]);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const keyRef = useRef(historyKey);
  const [busy, setBusy] = useState(false);
  // The stacks live in refs so the document-level key handler never closes over a stale copy; this
  // is what tells React to re-render the toolbar buttons when they change.
  const [, bumpStackVersion] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    keyRef.current = historyKey;
    pastRef.current = [];
    futureRef.current = [];
    bumpStackVersion();
  }, [historyKey]);

  /** Puts one mutation on the queue. `mutate` returns the step it performed, or null if it changed
   * nothing worth undoing. A failed mutation records no step - otherwise Strg+Z would offer to undo
   * a change that never reached the database. */
  const run = useCallback(
    (mutate: () => Promise<HistoryStep | null>, errorContext: string): Promise<void> => {
      const key = keyRef.current;
      setBusy(true);
      const task = queueRef.current.then(async () => {
        try {
          const step = await mutate();
          // A week switch while this was queued: the write already happened against the old
          // aggregate, but the step must not land on the new week's stack.
          if (step && key === keyRef.current) {
            pastRef.current = [...pastRef.current, { ...step, key }].slice(-MAX_STEPS);
            futureRef.current = [];
          }
        } catch (e) {
          onError(e, errorContext);
        }
      });
      queueRef.current = task;
      return task.finally(() => {
        if (queueRef.current === task) {
          setBusy(false);
        }
        bumpStackVersion();
      });
    },
    [onError],
  );

  /** Records a change that was already written elsewhere (the header fields save on blur, the
   * carry-over dialog applies its own batch), so it becomes undoable like every other edit. */
  const record = useCallback((step: HistoryStep) => {
    pastRef.current = [...pastRef.current, { ...step, key: keyRef.current }].slice(-MAX_STEPS);
    futureRef.current = [];
    bumpStackVersion();
  }, []);

  const move = useCallback(
    (direction: HistoryDirection) => {
      const from = direction === 'undo' ? pastRef : futureRef;
      const to = direction === 'undo' ? futureRef : pastRef;
      const step = from.current[from.current.length - 1];
      if (!step || step.key !== keyRef.current) {
        return Promise.resolve();
      }
      setBusy(true);
      const task = queueRef.current.then(async () => {
        try {
          await applyStep(step, direction);
          from.current = from.current.slice(0, -1);
          to.current = [...to.current, step];
        } catch (e) {
          onError(e, direction === 'undo' ? 'Rückgängig fehlgeschlagen' : 'Wiederholen fehlgeschlagen');
        }
      });
      queueRef.current = task;
      return task.finally(() => {
        if (queueRef.current === task) {
          setBusy(false);
        }
        bumpStackVersion();
      });
    },
    [applyStep, onError],
  );

  const undo = useCallback(() => move('undo'), [move]);
  const redo = useCallback(() => move('redo'), [move]);

  useEffect(() => {
    if (!shortcutsEnabled) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) {
        return;
      }
      // Inside a text field Strg+Z belongs to the browser: DecimalTextField manages its own
      // in-progress typing state, and taking its undo away would be worse than useless.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [shortcutsEnabled, undo, redo]);

  return {
    run,
    record,
    undo,
    redo,
    busy,
    canUndo: pastRef.current.length > 0 && !busy,
    canRedo: futureRef.current.length > 0 && !busy,
  };
}
