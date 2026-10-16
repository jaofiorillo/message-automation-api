import type {
  Flow,
  FlowContent,
  KeywordRule,
} from '../generated/prisma/client.js';
import type { Draft, DraftContent } from './domain/draft.schema.js';
import type { KeywordGroup } from './domain/keywords.js';

// Maps database rows to the API response. Json columns are written only by this
// module after validation, so reading them back with a type is safe.

export type FlowWithRelations = Flow & {
  contents: FlowContent[];
  keywordRules: KeywordRule[];
};

export function presentKeywordRule(rule: KeywordRule, ns: string) {
  return {
    ruleId: rule.id,
    ns,
    name: rule.name,
    channel: rule.channel,
    sort: rule.sort,
    keywordRules: rule.keywordRules as unknown as KeywordGroup[],
  };
}

export function presentFlowSummary(flow: Flow) {
  return {
    ns: flow.ns,
    name: flow.name,
    path: flow.path,
    status: flow.status,
    hasUnpublishedChanges: flow.draft !== null,
    publishedAt: flow.publishedAt,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}

export function presentFlow(flow: FlowWithRelations) {
  return {
    ...presentFlowSummary(flow),
    rootContentId: flow.rootContentId,
    draft: flow.draft as Draft | null,
    coordinates: (flow.coordinates ?? {}) as Draft['coordinates'],
    contents: flow.contents
      .filter((content) => !content.deleted)
      .map((content) => ({
        contentId: content.id,
        oid: content.oid,
        type: content.type,
        caption: content.caption,
        targetOid: content.targetOid,
        messages: (content.data as { messages: DraftContent['messages'] })
          .messages,
      })),
    triggers: {
      keywords: flow.keywordRules.map((rule) =>
        presentKeywordRule(rule, flow.ns),
      ),
    },
  };
}
