import type { DraftContent } from '../../automations/domain/draft.schema.js';

type FlowMessage = DraftContent['messages'][number];

// Body of `message` in POST /<IG_ID>/messages. A message with buttons becomes
// a button template (text up to 640 characters, 1 to 3 buttons).
export type InstagramMessage =
  | { text: string }
  | {
      attachment: {
        type: 'template';
        payload: {
          template_type: 'button';
          text: string;
          buttons: InstagramButton[];
        };
      };
    };

type InstagramButton =
  | { type: 'web_url'; title: string; url: string }
  | { type: 'postback'; title: string; payload: string };

// Recipient of a send: a contact (IGSID) or, for the first answer to a
// comment, the comment itself (a private reply).
export type InstagramRecipient = { id: string } | { comment_id: string };

// Postback payloads carry the published content id the button leads to, like
// ManyChat's numeric content_id. Ids stay stable across republishes.
const payloadPattern = /^content:(\d{1,15})$/;

export function contentPayload(contentId: number): string {
  return `content:${contentId}`;
}

export function parseContentPayload(payload: string): number | null {
  const match = payloadPattern.exec(payload);
  return match ? Number(match[1]) : null;
}

// `contentIds` maps content oids to published content ids. Publish validation
// guarantees every content button has a live target.
export function toInstagramMessage(
  message: FlowMessage,
  contentIds: ReadonlyMap<string, number>,
): InstagramMessage {
  if (message.buttons.length === 0) return { text: message.text };

  const buttons = message.buttons.map((button): InstagramButton => {
    if (button.action === 'url') {
      return { type: 'web_url', title: button.caption, url: button.url };
    }
    const target = button.targetOid && contentIds.get(button.targetOid);
    if (!target) {
      throw new Error(
        `Button "${button.oid}" targets missing content "${button.targetOid}"`,
      );
    }
    return {
      type: 'postback',
      title: button.caption,
      payload: contentPayload(target),
    };
  });

  return {
    attachment: {
      type: 'template',
      payload: { template_type: 'button', text: message.text, buttons },
    },
  };
}
