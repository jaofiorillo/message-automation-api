import type { Draft } from '../api/types';

// Undo/redo over whole drafts. Changes with the same key within a second
// (typing in one field) collapse into one step.
export interface History {
  past: Draft[];
  present: Draft;
  future: Draft[];
  lastKey: string | null;
  lastAt: number;
}

const coalesceMs = 1000;
const maxSteps = 100;

export function createHistory(draft: Draft): History {
  return { past: [], present: draft, future: [], lastKey: null, lastAt: 0 };
}

export function record(
  history: History,
  next: Draft,
  key: string | null,
  now: number,
): History {
  if (next === history.present) return history;
  const coalesce =
    key !== null &&
    key === history.lastKey &&
    now - history.lastAt < coalesceMs;
  return {
    past: coalesce
      ? history.past
      : [...history.past, history.present].slice(-maxSteps),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
    lastAt: 0,
  };
}

export function redo(history: History): History {
  const [next, ...future] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future,
    lastKey: null,
    lastAt: 0,
  };
}
