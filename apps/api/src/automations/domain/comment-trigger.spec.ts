import {
  commentTriggerInputSchema,
  matchesComment,
  normalizeKeywords,
} from './comment-trigger.js';

describe('commentTriggerInputSchema', () => {
  it('defaults to any post and any comment', () => {
    expect(commentTriggerInputSchema.parse({})).toEqual({
      sort: 0,
      mediaIds: [],
      includeKeywords: [],
      excludeKeywords: [],
      rootCommentsOnly: false,
      publicReplies: [],
    });
  });

  it.each([
    ['non-numeric media id', { mediaIds: ['abc'] }],
    ['blank keyword', { includeKeywords: ['  '] }],
    ['blank public reply', { publicReplies: ['  '] }],
    ['public reply over 300 characters', { publicReplies: ['a'.repeat(301)] }],
    ['non-boolean rootCommentsOnly', { rootCommentsOnly: 'yes' }],
  ])('rejects %s', (_label, input) => {
    expect(commentTriggerInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('normalizeKeywords', () => {
  it('trims, lowercases and deduplicates', () => {
    expect(normalizeKeywords([' Link ', 'LINK', 'Preço'])).toEqual([
      'link',
      'preço',
    ]);
  });
});

describe('matchesComment', () => {
  const anyComment = {
    mediaIds: [],
    includeKeywords: [],
    excludeKeywords: [],
    rootCommentsOnly: false,
  };
  const comment = { mediaId: '1', parentId: null, text: 'oi' };

  it('matches any comment on any post when unrestricted', () => {
    expect(matchesComment(anyComment, comment)).toBe(true);
    expect(
      matchesComment(anyComment, { mediaId: null, parentId: 'p', text: '' }),
    ).toBe(true);
  });

  it('restricts to the listed media', () => {
    const trigger = { ...anyComment, mediaIds: ['17890'] };
    expect(matchesComment(trigger, { ...comment, mediaId: '17890' })).toBe(
      true,
    );
    expect(matchesComment(trigger, { ...comment, mediaId: '99' })).toBe(false);
    expect(matchesComment(trigger, { ...comment, mediaId: null })).toBe(false);
  });

  it('requires an included keyword, ignoring case', () => {
    const trigger = { ...anyComment, includeKeywords: ['link'] };
    expect(matchesComment(trigger, { ...comment, text: 'Manda o LINK' })).toBe(
      true,
    );
    expect(matchesComment(trigger, { ...comment, text: 'lindo' })).toBe(false);
  });

  it('lets an excluded keyword win over an included one', () => {
    const trigger = {
      ...anyComment,
      includeKeywords: ['link'],
      excludeKeywords: ['spam'],
    };
    expect(
      matchesComment(trigger, { ...comment, text: 'link SPAM aqui' }),
    ).toBe(false);
    expect(
      matchesComment(
        { ...anyComment, excludeKeywords: ['spam'] },
        { ...comment, text: 'spam' },
      ),
    ).toBe(false);
  });

  it('skips replies to other comments when rootCommentsOnly is set', () => {
    const trigger = { ...anyComment, rootCommentsOnly: true };
    expect(matchesComment(trigger, comment)).toBe(true);
    expect(matchesComment(trigger, { ...comment, parentId: 'c0' })).toBe(false);
  });
});
