import { isHttpUrl, textUsage } from './limits';

describe('textUsage', () => {
  it('counts bytes without buttons and characters with buttons', () => {
    expect(textUsage('olá', false)).toMatchObject({ used: 4, max: 1000 });
    expect(textUsage('olá', true)).toMatchObject({ used: 3, max: 640 });
  });
});

describe('isHttpUrl', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com/a?b=1', true],
    ['javascript:alert(1)', false],
    ['https://', false],
    ['example.com', false],
  ])('%s → %s', (value, expected) => {
    expect(isHttpUrl(value)).toBe(expected);
  });
});
