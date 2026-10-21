import { z } from 'zod';

// Instagram webhook deliveries (Instagram API with Instagram Login). Meta adds
// fields over time, so objects are loose and each event is parsed on its own:
// one unexpected item must not drop the rest of a batch.

const id = z.string().min(1);

const messagingItem = z.looseObject({
  sender: z.looseObject({ id }),
  message: z
    .looseObject({
      mid: id,
      text: z.string().optional(),
      is_echo: z.boolean().optional(),
      quick_reply: z.looseObject({ payload: z.string() }).optional(),
    })
    .optional(),
  postback: z
    .looseObject({ mid: id, payload: z.string().optional() })
    .optional(),
});

// The comment id arrives as `id`; `comment_id` is accepted too because Meta's
// examples are inconsistent about it.
const commentValue = z
  .looseObject({
    id: id.optional(),
    comment_id: id.optional(),
    parent_id: id.optional(),
    text: z.string().default(''),
    from: z.looseObject({ id, username: z.string().optional() }),
    media: z.looseObject({ id }).optional(),
  })
  .refine((value) => value.id ?? value.comment_id);

const entry = z.looseObject({
  id,
  messaging: z.array(z.unknown()).default([]),
  changes: z.array(z.unknown()).default([]),
});

const change = z.looseObject({ field: z.string(), value: z.unknown() });

const delivery = z.looseObject({
  object: z.string(),
  entry: z.array(z.unknown()).default([]),
});

export type InstagramEvent =
  | { kind: 'message'; key: string; senderId: string; text: string }
  | { kind: 'postback'; key: string; senderId: string; payload: string }
  | {
      kind: 'comment';
      key: string;
      commentId: string;
      senderId: string;
      username: string | null;
      mediaId: string | null;
      parentId: string | null;
      text: string;
    };

// Turns a delivery into the events this app reacts to. Events for other
// accounts, echoes of our own messages and our own comments (public replies)
// are dropped, otherwise the account would answer itself.
export function parseWebhookEvents(
  body: unknown,
  accountId: string,
): InstagramEvent[] {
  const parsed = delivery.safeParse(body);
  if (!parsed.success || parsed.data.object !== 'instagram') return [];

  const events: InstagramEvent[] = [];
  for (const rawEntry of parsed.data.entry) {
    const item = entry.safeParse(rawEntry);
    if (!item.success || item.data.id !== accountId) continue;

    for (const raw of item.data.messaging) {
      const event = toMessagingEvent(raw, accountId);
      if (event) events.push(event);
    }
    for (const raw of item.data.changes) {
      const event = toCommentEvent(raw, accountId);
      if (event) events.push(event);
    }
  }
  return events;
}

function toMessagingEvent(
  raw: unknown,
  accountId: string,
): InstagramEvent | null {
  const parsed = messagingItem.safeParse(raw);
  if (!parsed.success) return null;
  const { sender, message, postback } = parsed.data;
  if (sender.id === accountId) return null;

  if (postback?.payload !== undefined) {
    return {
      kind: 'postback',
      key: `instagram:message:${postback.mid}`,
      senderId: sender.id,
      payload: postback.payload,
    };
  }
  if (!message || message.is_echo) return null;
  const key = `instagram:message:${message.mid}`;
  if (message.quick_reply) {
    return {
      kind: 'postback',
      key,
      senderId: sender.id,
      payload: message.quick_reply.payload,
    };
  }
  if (message.text === undefined) return null;
  return { kind: 'message', key, senderId: sender.id, text: message.text };
}

function toCommentEvent(
  raw: unknown,
  accountId: string,
): InstagramEvent | null {
  const parsedChange = change.safeParse(raw);
  if (!parsedChange.success || parsedChange.data.field !== 'comments') {
    return null;
  }
  const parsed = commentValue.safeParse(parsedChange.data.value);
  if (!parsed.success) return null;
  const value = parsed.data;
  if (value.from.id === accountId) return null;

  const commentId = (value.id ?? value.comment_id) as string;
  return {
    kind: 'comment',
    key: `instagram:comment:${commentId}`,
    commentId,
    senderId: value.from.id,
    username: value.from.username ?? null,
    mediaId: value.media?.id ?? null,
    parentId: value.parent_id ?? null,
    text: value.text,
  };
}
