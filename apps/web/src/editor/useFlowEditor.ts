import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { flowsApi, storeFlow } from '../api/flows';
import type { Draft, Flow } from '../api/types';
import { createHistory, record, redo, undo, type History } from './history';
import { draftFromFlow } from './model';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

const autosaveMs = 700;

// Editor state for one flow: the draft with undo/redo, and an autosave that
// PUTs the whole draft shortly after each change (ManyChat's
// "Salvando..." / "Salvo"). A live flow with no draft opens read-only, like
// ManyChat's "you are viewing the published version".
export function useFlowEditor(flow: Flow) {
  const client = useQueryClient();
  const [history, setHistory] = useState<History>(() =>
    createHistory(draftFromFlow(flow)),
  );
  const [mode, setMode] = useState<'view' | 'edit'>(
    flow.status === 'live' && flow.draft === null ? 'view' : 'edit',
  );
  const [status, setStatus] = useState<SaveStatus>('saved');

  const ns = flow.ns;
  const present = useRef(history.present);
  const version = useRef(0);
  const savedVersion = useRef(0);
  const inflight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(async (): Promise<void> => {
    clearTimeout(timer.current);
    while (inflight.current) await inflight.current.catch(() => undefined);
    if (savedVersion.current === version.current) return;

    const saving = version.current;
    setStatus('saving');
    const request = flowsApi
      .saveDraft(ns, present.current)
      .then((saved) => {
        savedVersion.current = saving;
        storeFlow(client, saved);
        setStatus(saving === version.current ? 'saved' : 'dirty');
      })
      .catch((error: unknown) => {
        setStatus('error');
        throw error;
      })
      .finally(() => {
        inflight.current = null;
      });
    inflight.current = request;
    await request;
    if (savedVersion.current !== version.current) await save();
  }, [client, ns]);

  const historyRef = useRef(history);

  const apply = useCallback(
    (next: History) => {
      if (next.present === present.current) return;
      historyRef.current = next;
      present.current = next.present;
      version.current += 1;
      setHistory(next);
      setStatus('dirty');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        save().catch(() => undefined);
      }, autosaveMs);
    },
    [save],
  );

  // `key` groups quick consecutive edits of one field into one undo step.
  const change = useCallback(
    (update: (draft: Draft) => Draft, key: string | null = null) => {
      if (mode !== 'edit') return;
      const current = historyRef.current;
      apply(record(current, update(current.present), key, Date.now()));
    },
    [apply, mode],
  );

  const onUndo = useCallback(() => {
    if (mode === 'edit') apply(undo(historyRef.current));
  }, [apply, mode]);
  const onRedo = useCallback(() => {
    if (mode === 'edit') apply(redo(historyRef.current));
  }, [apply, mode]);

  const publish = useCallback(async () => {
    await save();
    const published = await flowsApi.publish(ns);
    storeFlow(client, published);
    return published;
  }, [client, ns, save]);

  // A new flow starts with a draft built here (one empty step); store it right
  // away, as ManyChat's editor calls flow/setDraft when it opens a new flow.
  const isNew = flow.draft === null && flow.contents.length === 0;
  useEffect(() => {
    if (!isNew) return;
    version.current = Math.max(version.current, 1);
    save().catch(() => undefined);
    // Only on mount: later changes are saved by `apply`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (savedVersion.current !== version.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      clearTimeout(timer.current);
      // Leaving the editor (route change) still saves the last edits.
      if (savedVersion.current !== version.current) {
        save().catch(() => undefined);
      }
    };
  }, [save]);

  return {
    draft: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    mode,
    startEditing: () => setMode('edit'),
    status,
    change,
    undo: onUndo,
    redo: onRedo,
    save,
    publish,
  };
}

export type FlowEditor = ReturnType<typeof useFlowEditor>;
