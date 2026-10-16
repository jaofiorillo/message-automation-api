import type { Draft } from './draft.schema.js';

// Graph rules a draft must satisfy before it can go live. Removed contents are
// ignored entirely, and loops are allowed (a button may lead back to the start).
export function findPublishErrors(draft: Draft): string[] {
  const errors: string[] = [];
  const active = draft.contents.filter((content) => !content.removed);
  const oids = new Set<string>();

  for (const content of active) {
    if (oids.has(content.oid)) {
      errors.push(`Duplicated content oid "${content.oid}"`);
    }
    oids.add(content.oid);
  }

  if (active.length === 0) {
    errors.push('Flow has no contents');
  }
  if (!oids.has(draft.rootContent)) {
    errors.push(`Root content "${draft.rootContent}" does not exist`);
  }

  for (const content of active) {
    if (content.targetOid !== null && !oids.has(content.targetOid)) {
      errors.push(
        `Content "${content.oid}" targets missing content "${content.targetOid}"`,
      );
    }
    if (content.messages.length === 0) {
      errors.push(`Content "${content.oid}" has no messages`);
    }

    for (const message of content.messages) {
      if (message.text.trim() === '') {
        errors.push(`Message "${message.oid}" has no text`);
      }
      for (const button of message.buttons) {
        if (button.action !== 'content') continue;
        if (button.targetOid === undefined) {
          errors.push(`Button "${button.oid}" has no target`);
        } else if (!oids.has(button.targetOid)) {
          errors.push(
            `Button "${button.oid}" targets missing content "${button.targetOid}"`,
          );
        }
      }
    }
  }

  return errors;
}
