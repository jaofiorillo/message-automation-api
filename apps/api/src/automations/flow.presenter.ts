import type {
  CommentTrigger,
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
  commentTriggers: CommentTrigger[];
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

export function presentCommentTrigger(trigger: CommentTrigger, ns: string) {
  return {
    triggerId: trigger.id,
    ns,
    name: trigger.name,
    channel: 'instagram' as const,
    sort: trigger.sort,
    mediaIds: trigger.mediaIds,
    includeKeywords: trigger.includeKeywords,
    excludeKeywords: trigger.excludeKeywords,
    rootCommentsOnly: trigger.rootCommentsOnly,
    publicReplies: trigger.publicReplies,
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

export type FlowWithTriggers = Flow & {
  keywordRules: KeywordRule[];
  commentTriggers: CommentTrigger[];
};

function presentTriggers(flow: FlowWithTriggers) {
  return {
    keywords: flow.keywordRules.map((rule) =>
      presentKeywordRule(rule, flow.ns),
    ),
    comments: flow.commentTriggers.map((trigger) =>
      presentCommentTrigger(trigger, flow.ns),
    ),
  };
}

// List rows carry the triggers so the automations list can show and filter
// them, like ManyChat's list does.
export function presentFlowListItem(flow: FlowWithTriggers) {
  return { ...presentFlowSummary(flow), triggers: presentTriggers(flow) };
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
    triggers: presentTriggers(flow),
  };
}
