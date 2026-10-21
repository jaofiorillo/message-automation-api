import type {
  CommentTrigger,
  FlowTriggers,
  KeywordCondition,
  KeywordRule,
} from '../api/types';

// Wording follows ManyChat's Portuguese editor ("O usuário envia uma
// mensagem", "A mensagem contém nova").

export const conditionLabels: Record<KeywordCondition, string> = {
  is: 'é exatamente',
  contains: 'contém',
  starts_with: 'começa com',
};

export const triggerKinds = {
  keyword: {
    title: 'Mensagem no Instagram',
    description: 'O usuário envia uma mensagem',
  },
  comment: {
    title: 'Comentários na publicação ou Reel',
    description: 'O usuário deixa um comentário em sua publicação ou Reel',
  },
} as const;

export type TriggerKind = keyof typeof triggerKinds;

export function describeKeywordRule(rule: KeywordRule): string {
  return rule.keywordRules
    .map(
      (group) =>
        `A mensagem ${conditionLabels[group.condition]} ${group.keywords.join(', ')}`,
    )
    .join(' ou ');
}

export function describeCommentTrigger(trigger: CommentTrigger): string {
  const posts =
    trigger.mediaIds.length === 0
      ? 'Qualquer publicação ou Reel'
      : trigger.mediaIds.length === 1
        ? '1 publicação específica'
        : `${trigger.mediaIds.length} publicações específicas`;
  const words =
    trigger.includeKeywords.length === 0
      ? 'qualquer comentário'
      : `contém ${trigger.includeKeywords.join(', ')}`;
  return `${posts} · ${words}`;
}

export type TriggerFilter = 'any' | TriggerKind | 'none';

export function matchesTriggerFilter(
  triggers: FlowTriggers,
  filter: TriggerFilter,
): boolean {
  switch (filter) {
    case 'any':
      return true;
    case 'keyword':
      return triggers.keywords.length > 0;
    case 'comment':
      return triggers.comments.length > 0;
    case 'none':
      return triggers.keywords.length + triggers.comments.length === 0;
  }
}
