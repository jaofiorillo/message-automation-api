import { draftSchema, draftPatchSchema } from './draft.schema.js';
import { mergeDraft } from './merge-draft.js';

const base = draftSchema.parse({
  rootContent: 'c1',
  contents: [
    {
      oid: 'c1',
      type: 'message',
      caption: 'first',
      messages: [{ oid: 'm1', type: 'text', text: 'one' }],
    },
    {
      oid: 'c2',
      type: 'message',
      caption: 'second',
      messages: [{ oid: 'm2', type: 'text', text: 'two' }],
    },
  ],
  coordinates: { c1: { x: 0, y: 0 }, c2: { x: 10, y: 10 } },
});

function patch(input: unknown) {
  return draftPatchSchema.parse(input);
}

describe('mergeDraft', () => {
  it('replaces a content with the same oid and keeps the order', () => {
    const merged = mergeDraft(
      base,
      patch({
        contents: [
          {
            oid: 'c2',
            type: 'message',
            caption: 'changed',
            messages: [{ oid: 'm2', type: 'text', text: 'dois' }],
          },
        ],
      }),
    );
    expect(merged.contents.map((c) => c.oid)).toEqual(['c1', 'c2']);
    expect(merged.contents[1].caption).toBe('changed');
    expect(merged.contents[0]).toEqual(base.contents[0]);
  });

  it('appends contents with new oids', () => {
    const merged = mergeDraft(
      base,
      patch({
        contents: [
          {
            oid: 'c3',
            type: 'message',
            messages: [{ oid: 'm3', type: 'text', text: 'three' }],
          },
        ],
      }),
    );
    expect(merged.contents.map((c) => c.oid)).toEqual(['c1', 'c2', 'c3']);
  });

  it('keeps the root content unless the patch changes it', () => {
    expect(mergeDraft(base, patch({ coordinates: {} })).rootContent).toBe('c1');
    expect(mergeDraft(base, patch({ rootContent: 'c2' })).rootContent).toBe(
      'c2',
    );
  });

  it('merges coordinates by oid', () => {
    const merged = mergeDraft(
      base,
      patch({ coordinates: { c2: { x: 99, y: 99 }, c3: { x: 1, y: 2 } } }),
    );
    expect(merged.coordinates).toEqual({
      c1: { x: 0, y: 0 },
      c2: { x: 99, y: 99 },
      c3: { x: 1, y: 2 },
    });
  });

  it('does not mutate the current draft', () => {
    const snapshot = structuredClone(base);
    mergeDraft(
      base,
      patch({ rootContent: 'c2', coordinates: { c1: { x: 5, y: 5 } } }),
    );
    expect(base).toEqual(snapshot);
  });

  it('starts from an empty draft when there is none', () => {
    const merged = mergeDraft(
      null,
      patch({
        rootContent: 'c1',
        contents: [base.contents[0]],
      }),
    );
    expect(merged.rootContent).toBe('c1');
    expect(merged.contents).toHaveLength(1);
    expect(merged.coordinates).toEqual({});
  });
});
