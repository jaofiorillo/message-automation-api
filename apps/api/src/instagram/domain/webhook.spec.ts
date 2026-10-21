import { parseWebhookEvents } from './webhook.js';

const account = '17841400000000001';

function delivery(entry: Record<string, unknown>) {
  return { object: 'instagram', entry: [{ id: account, time: 1, ...entry }] };
}

function messaging(item: Record<string, unknown>) {
  return delivery({
    messaging: [
      {
        sender: { id: 'igsid-1' },
        recipient: { id: account },
        timestamp: 1,
        ...item,
      },
    ],
  });
}

function comment(value: Record<string, unknown>) {
  return delivery({ changes: [{ field: 'comments', value }] });
}

describe('parseWebhookEvents', () => {
  it('reads a text message', () => {
    expect(
      parseWebhookEvents(
        messaging({ message: { mid: 'm1', text: 'Oi' } }),
        account,
      ),
    ).toEqual([
      {
        kind: 'message',
        key: 'instagram:message:m1',
        senderId: 'igsid-1',
        text: 'Oi',
      },
    ]);
  });

  it('reads a button postback', () => {
    expect(
      parseWebhookEvents(
        messaging({
          postback: { mid: 'p1', title: 'Quero', payload: 'content:7' },
        }),
        account,
      ),
    ).toEqual([
      {
        kind: 'postback',
        key: 'instagram:message:p1',
        senderId: 'igsid-1',
        payload: 'content:7',
      },
    ]);
  });

  it('reads a quick reply as a postback', () => {
    const [event] = parseWebhookEvents(
      messaging({
        message: {
          mid: 'm2',
          text: 'Sim',
          quick_reply: { payload: 'content:3' },
        },
      }),
      account,
    );
    expect(event).toMatchObject({ kind: 'postback', payload: 'content:3' });
  });

  it('reads a comment, with the comment id in id or comment_id', () => {
    const value = {
      from: { id: 'igsid-2', username: 'maria' },
      text: 'LINK',
      media: { id: '1789', media_product_type: 'REELS' },
    };
    const expected = {
      kind: 'comment',
      key: 'instagram:comment:c1',
      commentId: 'c1',
      senderId: 'igsid-2',
      username: 'maria',
      mediaId: '1789',
      parentId: null,
      text: 'LINK',
    };
    expect(
      parseWebhookEvents(comment({ ...value, id: 'c1' }), account),
    ).toEqual([expected]);
    expect(
      parseWebhookEvents(comment({ ...value, comment_id: 'c1' }), account),
    ).toEqual([expected]);
  });

  it('keeps the parent id of a reply to another comment', () => {
    const [event] = parseWebhookEvents(
      comment({ id: 'c2', parent_id: 'c1', from: { id: 'igsid-2' } }),
      account,
    );
    expect(event).toMatchObject({ kind: 'comment', parentId: 'c1' });
  });

  it.each([
    ['echoes', messaging({ message: { mid: 'm', text: 'x', is_echo: true } })],
    [
      'messages sent by the account',
      delivery({
        messaging: [
          { sender: { id: account }, message: { mid: 'm', text: 'x' } },
        ],
      }),
    ],
    [
      'attachment-only messages',
      messaging({ message: { mid: 'm', attachments: [{ type: 'image' }] } }),
    ],
    ['reactions and reads', messaging({ read: { mid: 'm' } })],
    ['comments by the account', comment({ id: 'c', from: { id: account } })],
    ['comments without an id', comment({ from: { id: 'igsid' }, text: 'x' })],
    [
      'other change fields',
      delivery({ changes: [{ field: 'mentions', value: { media_id: '1' } }] }),
    ],
    ['other objects', { object: 'page', entry: [{ id: account }] }],
    ['malformed bodies', 'not json'],
  ])('ignores %s', (_label, body) => {
    expect(parseWebhookEvents(body, account)).toEqual([]);
  });

  it('ignores entries for other accounts', () => {
    const body = messaging({ message: { mid: 'm1', text: 'Oi' } });
    expect(parseWebhookEvents(body, 'someone-else')).toEqual([]);
  });

  it('keeps valid events when another item in the batch is malformed', () => {
    const body = delivery({
      messaging: [
        { sender: {}, message: { mid: 'bad' } },
        { sender: { id: 'igsid-1' }, message: { mid: 'm1', text: 'Oi' } },
      ],
    });
    expect(parseWebhookEvents(body, account)).toHaveLength(1);
  });
});
