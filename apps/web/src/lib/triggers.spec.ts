import type { CommentTrigger, KeywordRule } from '../api/types';
import {
  describeCommentTrigger,
  describeKeywordRule,
  matchesTriggerFilter,
} from './triggers';

const rule: KeywordRule = {
  ruleId: 1,
  ns: 'x',
  name: 'x',
  channel: 'instagram',
  sort: 0,
  keywordRules: [
    { condition: 'contains', keywords: ['nova'] },
    { condition: 'is', keywords: ['oi', 'olá'] },
  ],
};

const comment: CommentTrigger = {
  triggerId: 1,
  ns: 'x',
  name: 'x',
  channel: 'instagram',
  sort: 0,
  mediaIds: [],
  includeKeywords: [],
  excludeKeywords: [],
  rootCommentsOnly: false,
  publicReplies: [],
};

describe('trigger descriptions', () => {
  it('describes keyword groups like ManyChat', () => {
    expect(describeKeywordRule(rule)).toBe(
      'A mensagem contém nova ou A mensagem é exatamente oi, olá',
    );
  });

  it('describes comment triggers', () => {
    expect(describeCommentTrigger(comment)).toBe(
      'Qualquer publicação ou Reel · qualquer comentário',
    );
    expect(
      describeCommentTrigger({
        ...comment,
        mediaIds: ['1', '2'],
        includeKeywords: ['link'],
      }),
    ).toBe('2 publicações específicas · contém link');
  });
});

describe('matchesTriggerFilter', () => {
  const none = { keywords: [], comments: [] };
  it('filters by trigger kind', () => {
    expect(
      matchesTriggerFilter({ keywords: [rule], comments: [] }, 'keyword'),
    ).toBe(true);
    expect(
      matchesTriggerFilter({ keywords: [rule], comments: [] }, 'comment'),
    ).toBe(false);
    expect(matchesTriggerFilter(none, 'none')).toBe(true);
    expect(matchesTriggerFilter(none, 'any')).toBe(true);
  });
});
