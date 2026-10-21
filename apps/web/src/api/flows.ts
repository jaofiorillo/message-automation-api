import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  CommentTrigger,
  CommentTriggerInput,
  Draft,
  Flow,
  FlowSummary,
  KeywordRule,
  KeywordRuleInput,
} from './types';

export const flowKeys = {
  list: ['flows'] as const,
  detail: (ns: string) => ['flows', ns] as const,
};

export const flowsApi = {
  list: () => api<FlowSummary[]>('GET', '/flows?path=/'),
  get: (ns: string) => api<Flow>('GET', `/flows/${ns}`),
  create: (name: string) => api<Flow>('POST', '/flows', { name }),
  rename: (ns: string, name: string) =>
    api<Flow>('PATCH', `/flows/${ns}`, { name }),
  remove: (ns: string) => api<void>('DELETE', `/flows/${ns}`),
  saveDraft: (ns: string, draft: Draft) =>
    api<Flow>('PUT', `/flows/${ns}/draft`, draft),
  publish: (ns: string) => api<Flow>('POST', `/flows/${ns}/publish`),
  createKeyword: (ns: string, input: KeywordRuleInput) =>
    api<KeywordRule>('POST', `/flows/${ns}/keywords`, input),
  updateKeyword: (ns: string, ruleId: number, input: KeywordRuleInput) =>
    api<KeywordRule>('PUT', `/flows/${ns}/keywords/${ruleId}`, input),
  removeKeyword: (ns: string, ruleId: number) =>
    api<void>('DELETE', `/flows/${ns}/keywords/${ruleId}`),
  createComment: (ns: string, input: CommentTriggerInput) =>
    api<CommentTrigger>('POST', `/flows/${ns}/comment-triggers`, input),
  updateComment: (ns: string, triggerId: number, input: CommentTriggerInput) =>
    api<CommentTrigger>(
      'PUT',
      `/flows/${ns}/comment-triggers/${triggerId}`,
      input,
    ),
  removeComment: (ns: string, triggerId: number) =>
    api<void>('DELETE', `/flows/${ns}/comment-triggers/${triggerId}`),
};

export function useFlows() {
  return useQuery({ queryKey: flowKeys.list, queryFn: flowsApi.list });
}

export function useFlow(ns: string) {
  return useQuery({
    queryKey: flowKeys.detail(ns),
    queryFn: () => flowsApi.get(ns),
    // The editor owns the draft while it is open; refetching on focus would
    // overwrite local edits with the last saved copy.
    refetchOnWindowFocus: false,
  });
}

// Stores a flow returned by a mutation and marks the list as stale.
export function storeFlow(client: QueryClient, flow: Flow) {
  client.setQueryData(flowKeys.detail(flow.ns), flow);
  void client.invalidateQueries({ queryKey: flowKeys.list, exact: true });
}

export function useCreateFlow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: flowsApi.create,
    onSuccess: (flow) => storeFlow(client, flow),
  });
}

export function useRenameFlow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ns, name }: { ns: string; name: string }) =>
      flowsApi.rename(ns, name),
    onSuccess: (flow) => storeFlow(client, flow),
  });
}

export function useRemoveFlow() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: flowsApi.remove,
    onSuccess: (_result, ns) => {
      client.removeQueries({ queryKey: flowKeys.detail(ns) });
      void client.invalidateQueries({ queryKey: flowKeys.list, exact: true });
    },
  });
}

// Triggers are their own resources (like ManyChat's keyword rules and
// widgets): saving one does not touch the draft, so only the trigger lists
// are refreshed.
export function useTriggerMutations(ns: string) {
  const client = useQueryClient();
  // The detail is patched in place rather than refetched: a refetch would
  // also bring the last saved draft, which may be older than the editor's.
  const refresh = () =>
    void client.invalidateQueries({ queryKey: flowKeys.list, exact: true });
  const patchTriggers = (update: (flow: Flow) => Flow) =>
    client.setQueryData<Flow>(flowKeys.detail(ns), (flow) =>
      flow ? update(flow) : flow,
    );

  const saveKeyword = useMutation({
    mutationFn: ({
      ruleId,
      input,
    }: {
      ruleId?: number;
      input: KeywordRuleInput;
    }) =>
      ruleId === undefined
        ? flowsApi.createKeyword(ns, input)
        : flowsApi.updateKeyword(ns, ruleId, input),
    onSuccess: (rule) => {
      patchTriggers((flow) => ({
        ...flow,
        triggers: {
          ...flow.triggers,
          keywords: upsert(flow.triggers.keywords, rule, 'ruleId'),
        },
      }));
      refresh();
    },
  });

  const removeKeyword = useMutation({
    mutationFn: (ruleId: number) => flowsApi.removeKeyword(ns, ruleId),
    onSuccess: (_result, ruleId) => {
      patchTriggers((flow) => ({
        ...flow,
        triggers: {
          ...flow.triggers,
          keywords: flow.triggers.keywords.filter((r) => r.ruleId !== ruleId),
        },
      }));
      refresh();
    },
  });

  const saveComment = useMutation({
    mutationFn: ({
      triggerId,
      input,
    }: {
      triggerId?: number;
      input: CommentTriggerInput;
    }) =>
      triggerId === undefined
        ? flowsApi.createComment(ns, input)
        : flowsApi.updateComment(ns, triggerId, input),
    onSuccess: (trigger) => {
      patchTriggers((flow) => ({
        ...flow,
        triggers: {
          ...flow.triggers,
          comments: upsert(flow.triggers.comments, trigger, 'triggerId'),
        },
      }));
      refresh();
    },
  });

  const removeComment = useMutation({
    mutationFn: (triggerId: number) => flowsApi.removeComment(ns, triggerId),
    onSuccess: (_result, triggerId) => {
      patchTriggers((flow) => ({
        ...flow,
        triggers: {
          ...flow.triggers,
          comments: flow.triggers.comments.filter(
            (t) => t.triggerId !== triggerId,
          ),
        },
      }));
      refresh();
    },
  });

  return { saveKeyword, removeKeyword, saveComment, removeComment };
}

function upsert<T, K extends keyof T>(items: T[], item: T, key: K): T[] {
  const index = items.findIndex((other) => other[key] === item[key]);
  if (index === -1) return [...items, item];
  return items.map((other, i) => (i === index ? item : other));
}
