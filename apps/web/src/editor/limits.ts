// Limits enforced by the API (draft.schema.ts and publish-validation.ts),
// which come from Instagram's Send API and ManyChat's editor counters.
export const limits = {
  textWithButtons: 640,
  textBytes: 1000,
  buttonCaption: 20,
  buttonsPerMessage: 3,
  messagesPerContent: 10,
  contentCaption: 100,
  keyword: 100,
  keywordsPerGroup: 50,
  keywordGroups: 10,
  publicReply: 300,
  publicReplies: 10,
  mediaIds: 50,
} as const;

const encoder = new TextEncoder();

// What the counter under a message shows: characters with buttons (button
// template limit), UTF-8 bytes without (text message limit).
export function textUsage(text: string, hasButtons: boolean) {
  if (hasButtons) {
    return {
      used: text.length,
      max: limits.textWithButtons,
      unit: 'caracteres',
    };
  }
  return {
    used: encoder.encode(text).length,
    max: limits.textBytes,
    unit: 'bytes',
  };
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
