import type { Draft, Flow } from '../api/types';
import {
  addContent,
  connect,
  describePublishError,
  draftFromFlow,
  duplicateContent,
  edgesOf,
  freePosition,
  nextCaption,
  parseSourceHandle,
  removeContent,
  triggerNodeId,
} from './model';

function draft(): Draft {
  return {
    rootContent: 'c1',
    contents: [
      {
        oid: 'c1',
        type: 'message',
        caption: 'Boas-vindas',
        targetOid: 'c3',
        messages: [
          {
            oid: 'm1',
            type: 'text',
            text: 'Oi!',
            buttons: [
              {
                oid: 'b1',
                caption: 'Quero',
                action: 'content',
                targetOid: 'c2',
              },
              {
                oid: 'b2',
                caption: 'Site',
                action: 'url',
                url: 'https://example.com',
              },
            ],
          },
        ],
      },
      {
        oid: 'c2',
        type: 'message',
        caption: 'Link',
        targetOid: null,
        messages: [],
      },
      {
        oid: 'c3',
        type: 'message',
        caption: 'Depois',
        targetOid: null,
        messages: [],
      },
    ],
    coordinates: { c1: { x: 0, y: 0 } },
  };
}

const flow: Flow = {
  ns: 'content20261020120000_000001',
  name: 'Teste',
  path: '/',
  status: 'draft',
  hasUnpublishedChanges: false,
  publishedAt: null,
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: '2026-10-20T12:00:00.000Z',
  rootContentId: null,
  draft: null,
  coordinates: {},
  contents: [],
  triggers: { keywords: [], comments: [] },
};

describe('draftFromFlow', () => {
  it('starts a new flow with one empty step linked from the trigger', () => {
    const result = draftFromFlow(flow);
    expect(result.contents).toHaveLength(1);
    expect(result.rootContent).toBe(result.contents[0].oid);
    expect(result.contents[0]).toMatchObject({
      caption: 'Enviar Mensagem',
      messages: [],
    });
    expect(Object.keys(result.coordinates)).toContain(triggerNodeId);
  });

  it('prefers the unpublished draft and drops removed contents', () => {
    const stored = draft();
    stored.contents[2].removed = true;
    const result = draftFromFlow({ ...flow, draft: stored });
    expect(result.contents.map((c) => c.oid)).toEqual(['c1', 'c2']);
  });

  it('rebuilds the draft from the published contents', () => {
    const result = draftFromFlow({
      ...flow,
      status: 'live',
      rootContentId: 8,
      coordinates: { a: { x: 1, y: 2 } },
      contents: [
        {
          contentId: 7,
          oid: 'a',
          type: 'message',
          caption: 'A',
          targetOid: null,
          messages: [],
        },
        {
          contentId: 8,
          oid: 'b',
          type: 'message',
          caption: 'B',
          targetOid: 'a',
          messages: [],
        },
      ],
    });
    expect(result).toEqual({
      rootContent: 'b',
      coordinates: { a: { x: 1, y: 2 } },
      contents: [
        {
          oid: 'a',
          type: 'message',
          caption: 'A',
          targetOid: null,
          messages: [],
        },
        {
          oid: 'b',
          type: 'message',
          caption: 'B',
          targetOid: 'a',
          messages: [],
        },
      ],
    });
  });
});

describe('edgesOf', () => {
  it('lists the root link, next steps and content buttons', () => {
    expect(
      edgesOf(draft()).map((e) => [e.source, e.sourceHandle, e.target]),
    ).toEqual([
      [triggerNodeId, 'next', 'c1'],
      ['c1', 'next', 'c3'],
      ['c1', 'button:m1:b1', 'c2'],
    ]);
  });

  it('skips links to missing steps', () => {
    const broken = { ...draft(), rootContent: 'gone' };
    expect(edgesOf(broken).some((e) => e.source === triggerNodeId)).toBe(false);
  });
});

describe('connect', () => {
  it('moves the root but never clears it', () => {
    expect(connect(draft(), { kind: 'root' }, 'c2').rootContent).toBe('c2');
    expect(connect(draft(), { kind: 'root' }, null).rootContent).toBe('c1');
  });

  it('links and unlinks a content button', () => {
    const source = parseSourceHandle('c1', 'button:m1:b1');
    expect(source).toEqual({
      kind: 'button',
      contentOid: 'c1',
      messageOid: 'm1',
      buttonOid: 'b1',
    });
    const unlinked = connect(draft(), source!, null);
    expect(unlinked.contents[0].messages[0].buttons[0]).toEqual({
      oid: 'b1',
      caption: 'Quero',
      action: 'content',
    });
    const relinked = connect(unlinked, source!, 'c3');
    expect(relinked.contents[0].messages[0].buttons[0]).toMatchObject({
      targetOid: 'c3',
    });
  });

  it('sets the next step', () => {
    const next = connect(draft(), { kind: 'next', contentOid: 'c2' }, 'c3');
    expect(next.contents[1].targetOid).toBe('c3');
  });
});

describe('removeContent', () => {
  it('drops the step, its position and every link to it', () => {
    const result = removeContent(draft(), 'c2');
    expect(result.contents.map((c) => c.oid)).toEqual(['c1', 'c3']);
    expect(result.contents[0].messages[0].buttons[0]).not.toHaveProperty(
      'targetOid',
    );
    const after = removeContent(result, 'c3');
    expect(after.contents[0].targetOid).toBeNull();
  });
});

describe('addContent and duplicateContent', () => {
  it('adds a numbered step at a position', () => {
    const { draft: next, oid } = addContent(draft(), { x: 5, y: 6 });
    expect(next.contents.at(-1)).toMatchObject({
      oid,
      caption: 'Enviar Mensagem #1',
    });
    expect(next.coordinates[oid]).toEqual({ x: 5, y: 6 });
    expect(nextCaption(next)).toBe('Enviar Mensagem #2');
  });

  it('finds a free spot below overlapping nodes', () => {
    expect(freePosition(draft(), { x: 10, y: 10 })).toEqual({ x: 10, y: 230 });
    expect(freePosition(draft(), { x: 600, y: 0 })).toEqual({ x: 600, y: 0 });
  });

  it('copies a step with new oids', () => {
    const result = duplicateContent(draft(), 'c1')!;
    const copy = result.draft.contents.at(-1)!;
    expect(copy.oid).toBe(result.oid);
    expect(copy.caption).toBe('Boas-vindas (cópia)');
    expect(copy.messages[0].oid).not.toBe('m1');
    expect(copy.messages[0].buttons[0].oid).not.toBe('b1');
    expect(copy.messages[0].buttons[0]).toMatchObject({ targetOid: 'c2' });
  });
});

describe('describePublishError', () => {
  it('names steps and buttons instead of oids', () => {
    expect(describePublishError(draft(), 'Content "c2" has no messages')).toBe(
      'Etapa "Link" não tem mensagens.',
    );
    expect(describePublishError(draft(), 'Button "b1" has no target')).toBe(
      'O botão "Quero" não leva a nenhuma etapa.',
    );
    expect(
      describePublishError(draft(), 'Root content "x" does not exist'),
    ).toBe('O gatilho não está ligado a nenhuma etapa.');
  });

  it('keeps unknown errors as they are', () => {
    expect(describePublishError(draft(), 'Something else')).toBe(
      'Something else',
    );
  });
});
