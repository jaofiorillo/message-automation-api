import { z } from 'zod';

// Keyword triggers, modelled after ManyChat's keywords/create body. The
// condition and channel values are our own choice; the capture only showed
// that both are strings.
export const keywordConditions = ['is', 'contains', 'starts_with'] as const;
export const channels = [
  'instagram',
  'facebook',
  'whatsapp',
  'telegram',
] as const;

const keywordGroup = z.object({
  condition: z.enum(keywordConditions),
  keywords: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});

export const keywordRuleInputSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  channel: z.enum(channels),
  sort: z.number().int().min(0).default(0),
  keywordRules: z.array(keywordGroup).min(1).max(10),
});

export type KeywordGroup = z.infer<typeof keywordGroup>;
export type KeywordRuleInput = z.infer<typeof keywordRuleInputSchema>;

export interface KeywordConflict {
  ruleId: number;
  condition: KeywordGroup['condition'];
  keyword: string;
}

// Matching is case-insensitive, so keywords are stored lowercased.
export function normalizeKeywordRules(groups: KeywordGroup[]): KeywordGroup[] {
  return groups.map((group) => ({
    condition: group.condition,
    keywords: [
      ...new Set(group.keywords.map((keyword) => keyword.trim().toLowerCase())),
    ],
  }));
}

// Two rules on the same channel must not claim the same keyword under the same
// condition, otherwise an incoming message would match both.
export function findKeywordConflicts(
  groups: KeywordGroup[],
  existing: { id: number; keywordRules: KeywordGroup[] }[],
): KeywordConflict[] {
  const conflicts: KeywordConflict[] = [];
  for (const group of groups) {
    for (const rule of existing) {
      const taken = new Set(
        rule.keywordRules
          .filter((other) => other.condition === group.condition)
          .flatMap((other) => other.keywords),
      );
      for (const keyword of group.keywords) {
        if (taken.has(keyword)) {
          conflicts.push({
            ruleId: rule.id,
            condition: group.condition,
            keyword,
          });
        }
      }
    }
  }
  return conflicts;
}
