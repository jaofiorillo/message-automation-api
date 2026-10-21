import { createHmac, timingSafeEqual } from 'node:crypto';

// Meta signs every webhook delivery with the app secret:
// X-Hub-Signature-256: sha256=<hex HMAC-SHA256 of the raw request body>.
export function isValidSignature(
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const received = Buffer.from(header.slice('sha256='.length), 'hex');
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

export function signBody(rawBody: Buffer | string, appSecret: string): string {
  const digest = createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}
