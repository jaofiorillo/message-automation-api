import { z } from 'zod';

// Instagram "comment to DM" trigger, modelled after ManyChat's
// feed_comment_trigger widget (captured 2026-10-20): the comment gets a
// private reply with the flow and, optionally, a public reply under it.
const keyword = z.string().trim().min(1).max(100);

export const commentTriggerInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  sort: z.number().int().min(0).default(0),
  // Instagram media ids are numeric strings. Empty means any post or reel.
  mediaIds: z
    .array(z.string().regex(/^\d{1,32}$/, 'Invalid media id'))
    .max(50)
    .default([]),
  // "The comment contains these keywords". Empty means any comment.
  includeKeywords: z.array(keyword).max(50).default([]),
  // "The comment does not contain these keywords".
  excludeKeywords: z.array(keyword).max(50).default([]),
  rootCommentsOnly: z.boolean().default(false),
  publicReplies: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
});

export type CommentTriggerInput = z.infer<typeof commentTriggerInputSchema>;

export interface CommentTriggerRule {
  mediaIds: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  rootCommentsOnly: boolean;
}

export interface IncomingComment {
  mediaId: string | null;
  parentId: string | null;
  text: string;
}

// Matching ignores case (as ManyChat says in its editor), so keywords are
// stored lowercased.
export function normalizeKeywords(keywords: string[]): string[] {
  return [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()))];
}

export function matchesComment(
  trigger: CommentTriggerRule,
  comment: IncomingComment,
): boolean {
  if (trigger.rootCommentsOnly && comment.parentId !== null) return false;
  if (trigger.mediaIds.length > 0) {
    if (comment.mediaId === null) return false;
    if (!trigger.mediaIds.includes(comment.mediaId)) return false;
  }
  const text = comment.text.toLowerCase();
  if (trigger.excludeKeywords.some((keyword) => text.includes(keyword))) {
    return false;
  }
  if (trigger.includeKeywords.length === 0) return true;
  return trigger.includeKeywords.some((keyword) => text.includes(keyword));
}
