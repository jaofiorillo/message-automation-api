import type {
  ContentButton,
  Coordinates,
  Draft,
  DraftContent,
  Flow,
  FlowButton,
  FlowMessage,
} from '../api/types';

// Pure editor operations on a Draft. The canvas, the side panel and the
// autosave all go through these, so the draft sent to PUT /draft is always the
// single source of truth.

// Coordinates of the trigger node ("Quando..."). It is not a content, but
// ManyChat keeps its position with the others, so it is stored under this key.
export const triggerNodeId = 'trigger';

export const defaultCaption = 'Enviar Mensagem';

export function newOid(): string {
  return crypto.randomUUID();
}

export function emptyContent(caption = defaultCaption): DraftContent {
  return {
    oid: newOid(),
    type: 'message',
    caption,
    messages: [],
    targetOid: null,
  };
}

export function textMessage(text = ''): FlowMessage {
  return { oid: newOid(), type: 'text', text, buttons: [] };
}

// The draft to edit: the unpublished one, else the published version, else a
// new flow with an empty first step (what ManyChat shows on "Start from
// scratch").
export function draftFromFlow(flow: Flow): Draft {
  if (flow.draft) {
    return {
      ...flow.draft,
      contents: flow.draft.contents.filter((content) => !content.removed),
    };
  }
  if (flow.contents.length > 0) {
    const root =
      flow.contents.find(
        (content) => content.contentId === flow.rootContentId,
      ) ?? flow.contents[0];
    return {
      rootContent: root.oid,
      contents: flow.contents.map((content) => ({
        oid: content.oid,
        type: content.type,
        caption: content.caption,
        messages: content.messages,
        targetOid: content.targetOid,
      })),
      coordinates: flow.coordinates,
    };
  }
  const first = emptyContent();
  return {
    rootContent: first.oid,
    contents: [first],
    coordinates: {
      [triggerNodeId]: { x: 0, y: 0 },
      [first.oid]: { x: 420, y: 0 },
    },
  };
}

export function findContent(draft: Draft, oid: string) {
  return draft.contents.find((content) => content.oid === oid);
}

export function updateContent(
  draft: Draft,
  oid: string,
  update: (content: DraftContent) => DraftContent,
): Draft {
  return {
    ...draft,
    contents: draft.contents.map((content) =>
      content.oid === oid ? update(content) : content,
    ),
  };
}

export function updateMessage(
  draft: Draft,
  contentOid: string,
  messageOid: string,
  update: (message: FlowMessage) => FlowMessage,
): Draft {
  return updateContent(draft, contentOid, (content) => ({
    ...content,
    messages: content.messages.map((message) =>
      message.oid === messageOid ? update(message) : message,
    ),
  }));
}

export function updateButton(
  draft: Draft,
  contentOid: string,
  messageOid: string,
  buttonOid: string,
  update: (button: FlowButton) => FlowButton | null,
): Draft {
  return updateMessage(draft, contentOid, messageOid, (message) => ({
    ...message,
    buttons: message.buttons.flatMap((button) => {
      if (button.oid !== buttonOid) return [button];
      const next = update(button);
      return next ? [next] : [];
    }),
  }));
}

// ManyChat names new steps "Enviar Mensagem #1", "#2"... so they can be told
// apart in selects and publish errors.
export function nextCaption(draft: Draft): string {
  const taken = new Set(draft.contents.map((content) => content.caption));
  let index = 1;
  while (taken.has(`${defaultCaption} #${index}`)) index += 1;
  return `${defaultCaption} #${index}`;
}

const nodeBox = { width: 300, height: 220 };

// The first spot at or below `position` that does not overlap another node.
export function freePosition(draft: Draft, position: { x: number; y: number }) {
  const points = Object.values(draft.coordinates);
  const next = { ...position };
  while (
    points.some(
      (point) =>
        Math.abs(point.x - next.x) < nodeBox.width &&
        Math.abs(point.y - next.y) < nodeBox.height,
    )
  ) {
    next.y += nodeBox.height;
  }
  return next;
}

export function addContent(
  draft: Draft,
  position: { x: number; y: number },
  content = emptyContent(nextCaption(draft)),
): { draft: Draft; oid: string } {
  return {
    oid: content.oid,
    draft: {
      ...draft,
      contents: [...draft.contents, content],
      coordinates: { ...draft.coordinates, [content.oid]: position },
    },
  };
}

// Removes a step and every link pointing to it. A removed root leaves the
// trigger unconnected, which publish reports.
export function removeContent(draft: Draft, oid: string): Draft {
  const coordinates: Coordinates = { ...draft.coordinates };
  delete coordinates[oid];
  return {
    ...draft,
    coordinates,
    contents: draft.contents
      .filter((content) => content.oid !== oid)
      .map((content) => ({
        ...content,
        targetOid: content.targetOid === oid ? null : content.targetOid,
        messages: content.messages.map((message) => ({
          ...message,
          buttons: message.buttons.map((button) =>
            button.action === 'content' && button.targetOid === oid
              ? withoutTarget(button)
              : button,
          ),
        })),
      })),
  };
}

function withoutTarget(button: ContentButton): ContentButton {
  return { oid: button.oid, caption: button.caption, action: 'content' };
}

export function duplicateContent(
  draft: Draft,
  oid: string,
): { draft: Draft; oid: string } | null {
  const source = findContent(draft, oid);
  if (!source) return null;
  const position = draft.coordinates[oid] ?? { x: 0, y: 0 };
  const copy: DraftContent = {
    ...source,
    oid: newOid(),
    caption: `${source.caption} (cópia)`.slice(0, 100),
    messages: source.messages.map((message) => ({
      ...message,
      oid: newOid(),
      buttons: message.buttons.map((button) => ({ ...button, oid: newOid() })),
    })),
  };
  return addContent(draft, { x: position.x + 40, y: position.y + 220 }, copy);
}

export function moveNode(
  draft: Draft,
  id: string,
  position: { x: number; y: number },
): Draft {
  return { ...draft, coordinates: { ...draft.coordinates, [id]: position } };
}

// Source handles on the canvas: the trigger's "Então", a step's "Próximo
// Passo", or one of its content buttons.
export type SourceHandle =
  | { kind: 'root' }
  | { kind: 'next'; contentOid: string }
  | {
      kind: 'button';
      contentOid: string;
      messageOid: string;
      buttonOid: string;
    };

export const handleIds = {
  next: 'next',
  button: (messageOid: string, buttonOid: string) =>
    `button:${messageOid}:${buttonOid}`,
};

export function parseSourceHandle(
  nodeId: string,
  handleId: string | null | undefined,
): SourceHandle | null {
  if (nodeId === triggerNodeId) return { kind: 'root' };
  if (!handleId || handleId === handleIds.next) {
    return { kind: 'next', contentOid: nodeId };
  }
  const [prefix, messageOid, buttonOid] = handleId.split(':');
  if (prefix !== 'button' || !messageOid || !buttonOid) return null;
  return { kind: 'button', contentOid: nodeId, messageOid, buttonOid };
}

// Points a source handle at a step (target) or, with null, unlinks it. The
// root link can be moved but not removed: the draft always has a root.
export function connect(
  draft: Draft,
  source: SourceHandle,
  targetOid: string | null,
): Draft {
  switch (source.kind) {
    case 'root':
      return targetOid ? { ...draft, rootContent: targetOid } : draft;
    case 'next':
      return updateContent(draft, source.contentOid, (content) => ({
        ...content,
        targetOid,
      }));
    case 'button':
      return updateButton(
        draft,
        source.contentOid,
        source.messageOid,
        source.buttonOid,
        (button) =>
          button.action !== 'content'
            ? button
            : targetOid
              ? { ...button, targetOid }
              : withoutTarget(button),
      );
  }
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  deletable: boolean;
}

// Every link of the draft, as canvas edges. Links to missing steps are left
// out (they only exist in broken drafts and publish reports them).
export function edgesOf(draft: Draft): FlowEdge[] {
  const exists = new Set(draft.contents.map((content) => content.oid));
  const edges: FlowEdge[] = [];
  if (exists.has(draft.rootContent)) {
    edges.push({
      id: 'root',
      source: triggerNodeId,
      sourceHandle: handleIds.next,
      target: draft.rootContent,
      deletable: false,
    });
  }
  for (const content of draft.contents) {
    if (content.targetOid && exists.has(content.targetOid)) {
      edges.push({
        id: `next:${content.oid}`,
        source: content.oid,
        sourceHandle: handleIds.next,
        target: content.targetOid,
        deletable: true,
      });
    }
    for (const message of content.messages) {
      for (const button of message.buttons) {
        if (button.action !== 'content' || !button.targetOid) continue;
        if (!exists.has(button.targetOid)) continue;
        const handle = handleIds.button(message.oid, button.oid);
        edges.push({
          id: `${content.oid}:${handle}`,
          source: content.oid,
          sourceHandle: handle,
          target: button.targetOid,
          deletable: true,
        });
      }
    }
  }
  return edges;
}

// Where to put a new step linked from `fromOid`: to its right, below the
// steps already there.
export function positionNextTo(draft: Draft, fromOid: string) {
  const from = draft.coordinates[fromOid] ?? { x: 0, y: 0 };
  const x = from.x + 420;
  const taken = Object.values(draft.coordinates).filter(
    (point) => Math.abs(point.x - x) < 200 && point.y >= from.y - 50,
  );
  const y =
    taken.length === 0 ? from.y : Math.max(...taken.map((p) => p.y)) + 260;
  return { x, y };
}

// Publish errors name steps, messages and buttons by oid; this swaps them for
// what the user sees.
export function describePublishError(draft: Draft, error: string): string {
  const names = new Map<string, string>();
  for (const content of draft.contents) {
    names.set(content.oid, `etapa "${content.caption || defaultCaption}"`);
    content.messages.forEach((message, index) => {
      names.set(message.oid, `mensagem ${index + 1} de "${content.caption}"`);
      for (const button of message.buttons) {
        names.set(button.oid, `botão "${button.caption}"`);
      }
    });
  }
  const translations: [RegExp, string][] = [
    [/^Flow has no contents$/, 'A automação não tem etapas.'],
    [
      /^Root content "(.+)" does not exist$/,
      'O gatilho não está ligado a nenhuma etapa.',
    ],
    [/^Content "(.+)" has no messages$/, '$1 não tem mensagens.'],
    [
      /^Content "(.+)" targets missing content "(.+)"$/,
      '$1 aponta para uma etapa que não existe.',
    ],
    [/^Message "(.+)" has no text$/, 'A $1 está sem texto.'],
    [
      /^Message "(.+)" has buttons and more than (\d+) characters$/,
      'A $1 tem botões e passa de $2 caracteres.',
    ],
    [/^Message "(.+)" is longer than (\d+) bytes$/, 'A $1 passa de $2 bytes.'],
    [/^Button "(.+)" has no target$/, 'O $1 não leva a nenhuma etapa.'],
    [
      /^Button "(.+)" targets missing content "(.+)"$/,
      'O $1 aponta para uma etapa que não existe.',
    ],
    [/^Duplicated content oid "(.+)"$/, 'Há etapas duplicadas.'],
  ];
  for (const [pattern, replacement] of translations) {
    const match = error.match(pattern);
    if (!match) continue;
    const text = replacement.replace(/\$(\d)/g, (_all, group: string) => {
      const value = match[Number(group)] ?? '';
      return names.get(value) ?? value;
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return error;
}
