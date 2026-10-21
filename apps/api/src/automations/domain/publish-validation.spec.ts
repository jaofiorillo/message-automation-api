import type { Draft } from './draft.schema.js';
import { draftSchema } from './draft.schema.js';
import { findPublishErrors } from './publish-validation.js';

function draft(overrides: Partial<Draft> = {}): Draft {
  return draftSchema.parse({
    rootContent: 'c1',
    contents: [
      {
        oid: 'c1',
        type: 'message',
        messages: [
          {
            oid: 'm1',
            type: 'text',
            text: 'Oi',
            buttons: [
              {
                oid: 'b1',
                caption: 'Mais',
                action: 'content',
                targetOid: 'c2',
              },
            ],
          },
        ],
        targetOid: null,
      },
      {
        oid: 'c2',
        type: 'message',
        messages: [{ oid: 'm2', type: 'text', text: 'Aqui está' }],
        targetOid: null,
      },
    ],
    ...overrides,
  });
}

describe('findPublishErrors', () => {
  it('returns no errors for a valid graph', () => {
    expect(findPublishErrors(draft())).toEqual([]);
  });

  it('requires at least one content', () => {
    expect(findPublishErrors(draft({ contents: [] }))).toContain(
      'Flow has no contents',
    );
  });

  it('requires the root content to exist', () => {
    expect(findPublishErrors(draft({ rootContent: 'missing' }))).toContain(
      'Root content "missing" does not exist',
    );
  });

  it('rejects a removed root content', () => {
    const d = draft();
    d.contents[0].removed = true;
    expect(findPublishErrors(d)).toContain('Root content "c1" does not exist');
  });

  it('rejects duplicated content oids', () => {
    const d = draft();
    d.contents[1].oid = 'c1';
    expect(findPublishErrors(d)).toContain('Duplicated content oid "c1"');
  });

  it('rejects a content target that does not exist', () => {
    const d = draft();
    d.contents[1].targetOid = 'ghost';
    expect(findPublishErrors(d)).toContain(
      'Content "c2" targets missing content "ghost"',
    );
  });

  it('rejects a button target that points to a removed content', () => {
    const d = draft();
    d.contents[1].removed = true;
    expect(findPublishErrors(d)).toContain(
      'Button "b1" targets missing content "c2"',
    );
  });

  it('rejects a content button without a target', () => {
    const d = draft();
    const button = d.contents[0].messages[0].buttons[0] as {
      targetOid?: string;
    };
    button.targetOid = undefined;
    expect(findPublishErrors(d)).toContain('Button "b1" has no target');
  });

  it('rejects messages with blank text', () => {
    const d = draft();
    d.contents[1].messages[0].text = '   ';
    expect(findPublishErrors(d)).toContain('Message "m2" has no text');
  });

  it('rejects contents without messages', () => {
    const d = draft();
    d.contents[1].messages = [];
    expect(findPublishErrors(d)).toContain('Content "c2" has no messages');
  });

  it('ignores problems inside removed contents', () => {
    const d = draft();
    d.contents.push({
      ...d.contents[1],
      oid: 'c3',
      removed: true,
      messages: [],
      targetOid: 'ghost',
    });
    expect(findPublishErrors(d)).toEqual([]);
  });

  it('allows loops back to an earlier content', () => {
    const d = draft();
    d.contents[1].targetOid = 'c1';
    expect(findPublishErrors(d)).toEqual([]);
  });

  it('limits messages with buttons to 640 characters', () => {
    const d = draft();
    d.contents[0].messages[0].text = 'a'.repeat(641);
    expect(findPublishErrors(d)).toEqual([
      'Message "m1" has buttons and more than 640 characters',
    ]);
  });

  it('limits plain messages to 1000 UTF-8 bytes', () => {
    const d = draft();
    d.contents[1].messages[0].text = 'ç'.repeat(501);
    expect(findPublishErrors(d)).toEqual([
      'Message "m2" is longer than 1000 bytes',
    ]);
    d.contents[1].messages[0].text = 'ç'.repeat(500);
    expect(findPublishErrors(d)).toEqual([]);
  });
});
