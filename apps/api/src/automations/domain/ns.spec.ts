import { generateNs } from './ns.js';

describe('generateNs', () => {
  it('follows the ManyChat content<timestamp>_<6 digits> format', () => {
    const ns = generateNs(new Date('2026-10-16T17:04:20Z'), () => 317338);
    expect(ns).toBe('content20261016170420_317338');
  });

  it('pads the random suffix to 6 digits', () => {
    const ns = generateNs(new Date('2026-01-02T03:04:05Z'), () => 42);
    expect(ns).toBe('content20260102030405_000042');
  });

  it('uses a random suffix by default', () => {
    expect(generateNs()).toMatch(/^content\d{14}_\d{6}$/);
  });
});
