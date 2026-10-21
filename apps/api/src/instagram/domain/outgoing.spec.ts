import {
  contentPayload,
  parseContentPayload,
  toInstagramMessage,
} from './outgoing.js';

describe('toInstagramMessage', () => {
  const ids = new Map([['c2', 42]]);

  it('sends a plain text message without buttons', () => {
    expect(
      toInstagramMessage(
        { oid: 'm1', type: 'text', text: 'Oi', buttons: [] },
        ids,
      ),
    ).toEqual({ text: 'Oi' });
  });

  it('sends a button template with url and postback buttons', () => {
    expect(
      toInstagramMessage(
        {
          oid: 'm1',
          type: 'text',
          text: 'Quer o link?',
          buttons: [
            { oid: 'b1', caption: 'Quero', action: 'content', targetOid: 'c2' },
            {
              oid: 'b2',
              caption: 'Site',
              action: 'url',
              url: 'https://example.com',
            },
          ],
        },
        ids,
      ),
    ).toEqual({
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: 'Quer o link?',
          buttons: [
            { type: 'postback', title: 'Quero', payload: 'content:42' },
            { type: 'web_url', title: 'Site', url: 'https://example.com' },
          ],
        },
      },
    });
  });

  it('fails loudly when a button target is not published', () => {
    expect(() =>
      toInstagramMessage(
        {
          oid: 'm1',
          type: 'text',
          text: 'x',
          buttons: [
            { oid: 'b1', caption: 'x', action: 'content', targetOid: 'ghost' },
          ],
        },
        ids,
      ),
    ).toThrow('Button "b1" targets missing content "ghost"');
  });
});

describe('content payloads', () => {
  it('round-trips a content id', () => {
    expect(parseContentPayload(contentPayload(7))).toBe(7);
  });

  it.each([
    '',
    'content:',
    'content:abc',
    'flow:1',
    'content:1:2',
    'CONTENT:1',
  ])('rejects %j', (payload) => {
    expect(parseContentPayload(payload)).toBeNull();
  });
});
