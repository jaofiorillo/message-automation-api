import { isValidSignature, signBody } from './signature.js';

describe('isValidSignature', () => {
  const body = Buffer.from('{"object":"instagram","entry":[]}');

  it('accepts a signature made with the app secret', () => {
    expect(isValidSignature(body, signBody(body, 'secret'), 'secret')).toBe(
      true,
    );
  });

  it.each([
    ['missing header', undefined],
    ['other secret', signBody(body, 'other')],
    ['sha1 header', 'sha1=abc'],
    ['truncated digest', signBody(body, 'secret').slice(0, 20)],
    ['not hex', 'sha256=zzzz'],
  ])('rejects %s', (_label, header) => {
    expect(isValidSignature(body, header, 'secret')).toBe(false);
  });

  it('rejects a body changed after signing', () => {
    const header = signBody(body, 'secret');
    expect(isValidSignature(Buffer.from('{}'), header, 'secret')).toBe(false);
  });
});
