// Mirrors the responses of apps/api (see apps/api/CLAUDE.md, "API"). Kept by
// hand until the schemas move to a shared package.

export type FlowStatus = 'draft' | 'live';
export type KeywordCondition = 'is' | 'contains' | 'starts_with';
export type Channel = 'instagram' | 'facebook' | 'whatsapp' | 'telegram';

export type ContentButton = {
  oid: string;
  caption: string;
  action: 'content';
  targetOid?: string;
};

export type UrlButton = {
  oid: string;
  caption: string;
  action: 'url';
  url: string;
};

export type FlowButton = ContentButton | UrlButton;

export interface FlowMessage {
  oid: string;
  type: 'text';
  text: string;
  buttons: FlowButton[];
}

export interface DraftContent {
  oid: string;
  type: 'message';
  caption: string;
  messages: FlowMessage[];
  targetOid: string | null;
  removed?: boolean;
}

export type Coordinates = Record<string, { x: number; y: number }>;

export interface Draft {
  rootContent: string;
  contents: DraftContent[];
  coordinates: Coordinates;
}

export interface PublishedContent {
  contentId: number;
  oid: string;
  type: 'message';
  caption: string;
  targetOid: string | null;
  messages: FlowMessage[];
}

export interface KeywordGroup {
  condition: KeywordCondition;
  keywords: string[];
}

export interface KeywordRule {
  ruleId: number;
  ns: string;
  name: string;
  channel: Channel;
  sort: number;
  keywordRules: KeywordGroup[];
}

export interface KeywordRuleInput {
  channel: Channel;
  keywordRules: KeywordGroup[];
  name?: string;
  sort?: number;
}

export interface CommentTrigger {
  triggerId: number;
  ns: string;
  name: string;
  channel: 'instagram';
  sort: number;
  mediaIds: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  rootCommentsOnly: boolean;
  publicReplies: string[];
}

export type CommentTriggerInput = Pick<
  CommentTrigger,
  | 'mediaIds'
  | 'includeKeywords'
  | 'excludeKeywords'
  | 'rootCommentsOnly'
  | 'publicReplies'
> & { name?: string; sort?: number };

export interface FlowTriggers {
  keywords: KeywordRule[];
  comments: CommentTrigger[];
}

export interface FlowSummary {
  ns: string;
  name: string;
  path: string;
  status: FlowStatus;
  hasUnpublishedChanges: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  triggers: FlowTriggers;
}

export interface Flow extends FlowSummary {
  rootContentId: number | null;
  draft: Draft | null;
  coordinates: Coordinates;
  contents: PublishedContent[];
}

export interface KeywordConflict {
  ruleId: number;
  condition: KeywordCondition;
  keyword: string;
}
