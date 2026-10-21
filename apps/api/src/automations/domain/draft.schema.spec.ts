import { draftSchema, draftPatchSchema } from './draft.schema.js';

const validDraft = {
  rootContent: 'c1',
  contents: [
    {
      oid: 'c1',
      type: 'message',
      caption: 'Welcome',
      messages: [
        {
          oid: 'm1',
          type: 'text',
          text: 'Oi! Quer o link?',
          buttons: [
            { oid: 'b1', caption: 'Quero', action: 'content', targetOid: 'c2' },
            {
              oid: 'b2',
              caption: 'Site',
              action: 'url',
              url: 'https://example.com',
            },
          ],
        },
      ],
      targetOid: null,
    },
  ],
  coordinates: { c1: { x: 100, y: 200 } },
};

describe('draftSchema', () => {
  it('accepts a complete draft', () => {
    expect(draftSchema.safeParse(validDraft).success).toBe(true);
  });

  it('defaults optional fields', () => {
    const parsed = draftSchema.parse({
      rootContent: 'c1',
      contents: [
        {
          oid: 'c1',
          type: 'message',
          messages: [{ oid: 'm1', type: 'text', text: 'hi' }],
        },
      ],
    });
    const content = parsed.contents[0];
    expect(content.caption).toBe('');
    expect(content.targetOid).toBeNull();
    expect(content.removed).toBe(false);
    expect(content.messages[0].buttons).toEqual([]);
    expect(parsed.coordinates).toEqual({});
  });

  it('allows an empty message text while drafting', () => {
    const draft = structuredClone(validDraft);
    draft.contents[0].messages[0].text = '';
    expect(draftSchema.safeParse(draft).success).toBe(true);
  });

  it('rejects message text over 1000 characters', () => {
    const draft = structuredClone(validDraft);
    draft.contents[0].messages[0].text = 'a'.repeat(1001);
    expect(draftSchema.safeParse(draft).success).toBe(false);
  });

  it.each(['javascript:alert(1)', 'ftp://example.com', 'not a url'])(
    'rejects non-http(s) button url %s',
    (url) => {
      const draft = structuredClone(validDraft);
      draft.contents[0].messages[0].buttons[1].url = url;
      expect(draftSchema.safeParse(draft).success).toBe(false);
    },
  );

  it('requires a url on url buttons', () => {
    const draft = structuredClone(validDraft);
    delete (draft.contents[0].messages[0].buttons[1] as { url?: string }).url;
    expect(draftSchema.safeParse(draft).success).toBe(false);
  });

  it('rejects unknown content types', () => {
    const draft = structuredClone(validDraft);
    draft.contents[0].type = 'payment';
    expect(draftSchema.safeParse(draft).success).toBe(false);
  });

  it('rejects coordinates that are not numbers', () => {
    const draft = { ...validDraft, coordinates: { c1: { x: '1', y: 2 } } };
    expect(draftSchema.safeParse(draft).success).toBe(false);
  });

  it('caps the number of contents per draft', () => {
    const content = validDraft.contents[0];
    const draft = {
      ...validDraft,
      contents: Array.from({ length: 501 }, (_, i) => ({
        ...content,
        oid: `c${i}`,
      })),
    };
    expect(draftSchema.safeParse(draft).success).toBe(false);
  });
});

describe('draftPatchSchema', () => {
  it('accepts a patch with only contents', () => {
    const patch = { contents: validDraft.contents };
    expect(draftPatchSchema.safeParse(patch).success).toBe(true);
  });

  it('accepts a patch with only coordinates', () => {
    const patch = { coordinates: { c1: { x: 1, y: 1 } } };
    expect(draftPatchSchema.safeParse(patch).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(draftPatchSchema.safeParse({}).success).toBe(false);
  });
});
