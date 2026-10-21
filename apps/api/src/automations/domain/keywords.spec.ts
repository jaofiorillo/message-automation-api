import {
  findKeywordConflicts,
  matchesKeywordGroups,
  keywordRuleInputSchema,
  normalizeKeywordRules,
} from './keywords.js';

describe('keywordRuleInputSchema', () => {
  const valid = {
    channel: 'instagram',
    keywordRules: [{ condition: 'is', keywords: ['oi'] }],
  };

  it('accepts a minimal rule and fills defaults', () => {
    const parsed = keywordRuleInputSchema.parse(valid);
    expect(parsed.sort).toBe(0);
    expect(parsed.name).toBeUndefined();
  });

  it.each([
    ['unknown channel', { ...valid, channel: 'sms' }],
    [
      'unknown condition',
      { ...valid, keywordRules: [{ condition: 'regex', keywords: ['a'] }] },
    ],
    ['no keyword groups', { ...valid, keywordRules: [] }],
    [
      'empty keyword list',
      { ...valid, keywordRules: [{ condition: 'is', keywords: [] }] },
    ],
    [
      'blank keyword',
      { ...valid, keywordRules: [{ condition: 'is', keywords: ['  '] }] },
    ],
  ])('rejects %s', (_label, input) => {
    expect(keywordRuleInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('normalizeKeywordRules', () => {
  it('trims, lowercases and deduplicates keywords', () => {
    expect(
      normalizeKeywordRules([
        { condition: 'contains', keywords: [' Preço ', 'preço', 'LINK'] },
      ]),
    ).toEqual([{ condition: 'contains', keywords: ['preço', 'link'] }]);
  });
});

describe('findKeywordConflicts', () => {
  const existing = [
    {
      id: 7,
      keywordRules: [
        { condition: 'is' as const, keywords: ['oi', 'olá'] },
        { condition: 'contains' as const, keywords: ['preço'] },
      ],
    },
  ];

  it('reports the same keyword with the same condition', () => {
    expect(
      findKeywordConflicts(
        [{ condition: 'is', keywords: ['olá', 'menu'] }],
        existing,
      ),
    ).toEqual([{ ruleId: 7, condition: 'is', keyword: 'olá' }]);
  });

  it('allows the same keyword under a different condition', () => {
    expect(
      findKeywordConflicts(
        [{ condition: 'contains', keywords: ['oi'] }],
        existing,
      ),
    ).toEqual([]);
  });

  it('returns nothing when there are no existing rules', () => {
    expect(
      findKeywordConflicts([{ condition: 'is', keywords: ['oi'] }], []),
    ).toEqual([]);
  });
});

describe('matchesKeywordGroups', () => {
  const groups = normalizeKeywordRules([
    { condition: 'is', keywords: ['Oi'] },
    { condition: 'contains', keywords: ['preço'] },
    { condition: 'starts_with', keywords: ['quero'] },
  ]);

  it.each([
    ['  OI ', true],
    ['oi tudo bem', false],
    ['qual o PREÇO?', true],
    ['Quero o link', true],
    ['eu quero', false],
    ['', false],
  ])('%j → %s', (text, expected) => {
    expect(matchesKeywordGroups(text, groups)).toBe(expected);
  });
});
