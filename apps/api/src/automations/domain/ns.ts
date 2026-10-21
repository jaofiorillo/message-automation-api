import { randomInt } from 'node:crypto';

// Flow identifier in ManyChat's format: content<YYYYMMDDHHmmss UTC>_<6 digits>.
export function generateNs(
  now: Date = new Date(),
  random: () => number = () => randomInt(0, 1_000_000),
): string {
  const timestamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/\D/g, '');
  const suffix = String(random()).padStart(6, '0');
  return `content${timestamp}_${suffix}`;
}
