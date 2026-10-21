import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { signBody } from './../src/instagram/domain/signature.js';
import { InstagramClient } from './../src/instagram/instagram.client.js';
import { InstagramConfig } from './../src/instagram/instagram.config.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const account = '17841400000000001';
const appSecret = 'test-app-secret';

const config = Object.assign(new InstagramConfig(), {
  accountId: account,
  accessToken: 'test-token',
  appSecret,
  verifyToken: 'test-verify-token',
});

function draftBody() {
  return {
    rootContent: 'c1',
    contents: [
      {
        oid: 'c1',
        type: 'message',
        messages: [
          {
            oid: 'm1',
            type: 'text',
            text: 'Oi! Quer receber o link?',
            buttons: [
              {
                oid: 'b1',
                caption: 'Quero',
                action: 'content',
                targetOid: 'c2',
              },
            ],
          },
          { oid: 'm1b', type: 'text', text: 'É só tocar no botão' },
        ],
      },
      {
        oid: 'c2',
        type: 'message',
        messages: [
          {
            oid: 'm2',
            type: 'text',
            text: 'Aqui está',
            buttons: [
              {
                oid: 'b2',
                caption: 'Abrir',
                action: 'url',
                url: 'https://example.com',
              },
            ],
          },
        ],
        targetOid: 'c3',
      },
      {
        oid: 'c3',
        type: 'message',
        messages: [{ oid: 'm3', type: 'text', text: 'Até mais!' }],
      },
    ],
  };
}

function messaging(item: Record<string, unknown>) {
  return {
    object: 'instagram',
    entry: [
      {
        id: account,
        time: 1,
        messaging: [
          {
            sender: { id: 'igsid-1' },
            recipient: { id: account },
            timestamp: 1,
            ...item,
          },
        ],
      },
    ],
  };
}

function comment(value: Record<string, unknown>) {
  return {
    object: 'instagram',
    entry: [{ id: account, time: 1, changes: [{ field: 'comments', value }] }],
  };
}

describe('Instagram runtime (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const instagram = {
    sendMessage: vi.fn(),
    replyToComment: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(InstagramConfig)
      .useValue(config)
      .overrideProvider(InstagramClient)
      .useValue(instagram)
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      rawBody: true,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.flow.deleteMany();
    await prisma.inboundEvent.deleteMany();
    await prisma.contact.deleteMany();
    instagram.sendMessage.mockReset().mockResolvedValue({
      recipient_id: 'igsid-1',
      message_id: 'out-1',
    });
    instagram.replyToComment.mockReset().mockResolvedValue({ id: 'reply-1' });
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  function deliver(body: unknown, secret = appSecret) {
    const raw = JSON.stringify(body);
    return http()
      .post('/webhooks/instagram')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signBody(raw, secret))
      .send(raw);
  }

  async function liveFlow() {
    const created = await http().post('/flows').send({ name: 'Link' });
    const ns = created.body.ns as string;
    await http().put(`/flows/${ns}/draft`).send(draftBody()).expect(200);
    const published = await http().post(`/flows/${ns}/publish`).expect(200);
    const ids = Object.fromEntries(
      published.body.contents.map((c: { oid: string; contentId: number }) => [
        c.oid,
        c.contentId,
      ]),
    ) as Record<string, number>;
    return { ns, ids };
  }

  function sentMessages() {
    return instagram.sendMessage.mock.calls.map(([recipient, message]) => ({
      recipient,
      message,
    }));
  }

  describe('GET /webhooks/instagram', () => {
    it('answers the subscription handshake', async () => {
      const res = await http()
        .get('/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'test-verify-token',
          'hub.challenge': '1158201444',
        })
        .expect(200);
      expect(res.text).toBe('1158201444');
    });

    it('refuses a wrong verify token', async () => {
      await http()
        .get('/webhooks/instagram')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'nope',
          'hub.challenge': '1',
        })
        .expect(403);
    });
  });

  describe('POST /webhooks/instagram', () => {
    it('rejects unsigned and wrongly signed deliveries', async () => {
      await http()
        .post('/webhooks/instagram')
        .send(messaging({ message: { mid: 'm1', text: 'oi' } }))
        .expect(403);
      await deliver(
        messaging({ message: { mid: 'm1', text: 'oi' } }),
        'other-secret',
      ).expect(403);
      expect(instagram.sendMessage).not.toHaveBeenCalled();
    });

    it('starts a flow from a DM keyword and records the contact', async () => {
      const { ns, ids } = await liveFlow();
      await http()
        .post(`/flows/${ns}/keywords`)
        .send({
          channel: 'instagram',
          keywordRules: [{ condition: 'is', keywords: ['link'] }],
        })
        .expect(201);

      const res = await deliver(
        messaging({ message: { mid: 'm1', text: ' LINK ' } }),
      ).expect(200);

      expect(res.body).toEqual({ received: 1 });
      expect(sentMessages()).toEqual([
        {
          recipient: { id: 'igsid-1' },
          message: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                text: 'Oi! Quer receber o link?',
                buttons: [
                  {
                    type: 'postback',
                    title: 'Quero',
                    payload: `content:${ids.c2}`,
                  },
                ],
              },
            },
          },
        },
        {
          recipient: { id: 'igsid-1' },
          message: { text: 'É só tocar no botão' },
        },
      ]);
      const contact = await prisma.contact.findUniqueOrThrow({
        where: {
          channel_externalId: { channel: 'instagram', externalId: 'igsid-1' },
        },
      });
      expect(contact.lastInteractionAt).toBeInstanceOf(Date);
    });

    it('continues from a button postback and follows content targets', async () => {
      const { ids } = await liveFlow();

      await deliver(
        messaging({
          postback: { mid: 'p1', title: 'Quero', payload: `content:${ids.c2}` },
        }),
      ).expect(200);

      expect(sentMessages().map((sent) => sent.message)).toEqual([
        {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: 'Aqui está',
              buttons: [
                { type: 'web_url', title: 'Abrir', url: 'https://example.com' },
              ],
            },
          },
        },
        { text: 'Até mais!' },
      ]);
    });

    it('handles a retried delivery only once', async () => {
      const { ids } = await liveFlow();
      const body = messaging({
        postback: { mid: 'p1', payload: `content:${ids.c3}` },
      });

      await deliver(body).expect(200);
      await deliver(body).expect(200);

      expect(instagram.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('ignores keywords of flows that are not live and unknown payloads', async () => {
      const created = await http().post('/flows').send({ name: 'Rascunho' });
      await http()
        .post(`/flows/${created.body.ns}/keywords`)
        .send({
          channel: 'instagram',
          keywordRules: [{ condition: 'is', keywords: ['oi'] }],
        })
        .expect(201);

      await deliver(messaging({ message: { mid: 'm1', text: 'oi' } })).expect(
        200,
      );
      await deliver(
        messaging({ postback: { mid: 'p1', payload: 'content:999999' } }),
      ).expect(200);

      expect(instagram.sendMessage).not.toHaveBeenCalled();
    });

    it('answers 200 and keeps going when a send fails', async () => {
      const { ids } = await liveFlow();
      instagram.sendMessage
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ recipient_id: 'igsid-1', message_id: 'out-2' });
      const body = {
        object: 'instagram',
        entry: [
          {
            id: account,
            time: 1,
            messaging: [
              {
                sender: { id: 'igsid-1' },
                postback: { mid: 'p1', payload: `content:${ids.c3}` },
              },
              {
                sender: { id: 'igsid-2' },
                postback: { mid: 'p2', payload: `content:${ids.c3}` },
              },
            ],
          },
        ],
      };

      await deliver(body).expect(200);

      expect(instagram.sendMessage).toHaveBeenCalledTimes(2);
      expect(instagram.sendMessage.mock.calls[1][0]).toEqual({ id: 'igsid-2' });
    });
  });

  describe('comment triggers', () => {
    it('creates a comment trigger shown in the flow triggers', async () => {
      const { ns } = await liveFlow();
      const res = await http()
        .post(`/flows/${ns}/comment-triggers`)
        .send({
          mediaIds: ['17890001'],
          includeKeywords: ['LINK'],
          excludeKeywords: ['Spam'],
          rootCommentsOnly: true,
          publicReplies: ['Te mandei no direct!'],
        })
        .expect(201);

      expect(res.body).toEqual({
        triggerId: expect.any(Number),
        ns,
        name: 'Link',
        channel: 'instagram',
        sort: 0,
        mediaIds: ['17890001'],
        includeKeywords: ['link'],
        excludeKeywords: ['spam'],
        rootCommentsOnly: true,
        publicReplies: ['Te mandei no direct!'],
      });
      const flow = await http().get(`/flows/${ns}`).expect(200);
      expect(flow.body.triggers.comments).toEqual([res.body]);
    });

    it('rejects an invalid media id', async () => {
      const { ns } = await liveFlow();
      await http()
        .post(`/flows/${ns}/comment-triggers`)
        .send({ mediaIds: ['../x'] })
        .expect(400);
    });

    it('sends one private reply and a public reply to a matching comment', async () => {
      const { ns } = await liveFlow();
      await http()
        .post(`/flows/${ns}/comment-triggers`)
        .send({
          mediaIds: ['17890001'],
          includeKeywords: ['link'],
          publicReplies: ['Te mandei no direct!'],
        })
        .expect(201);

      await deliver(
        comment({
          id: 'comment-1',
          text: 'Quero o LINK',
          from: { id: 'igsid-9', username: 'maria' },
          media: { id: '17890001', media_product_type: 'REELS' },
        }),
      ).expect(200);

      expect(sentMessages()).toHaveLength(1);
      expect(sentMessages()[0].recipient).toEqual({ comment_id: 'comment-1' });
      expect(instagram.replyToComment).toHaveBeenCalledWith(
        'comment-1',
        'Te mandei no direct!',
      );
      const contact = await prisma.contact.findUniqueOrThrow({
        where: {
          channel_externalId: { channel: 'instagram', externalId: 'igsid-9' },
        },
      });
      expect(contact.username).toBe('maria');
    });

    it('ignores other media, non-matching or excluded text, replies and our own comments', async () => {
      const { ns } = await liveFlow();
      await http()
        .post(`/flows/${ns}/comment-triggers`)
        .send({
          mediaIds: ['17890001'],
          includeKeywords: ['link'],
          excludeKeywords: ['spam'],
          rootCommentsOnly: true,
        })
        .expect(201);

      await deliver(
        comment({
          id: 'c-a',
          text: 'link',
          from: { id: 'igsid-9' },
          media: { id: '555' },
        }),
      ).expect(200);
      await deliver(
        comment({
          id: 'c-b',
          text: 'lindo',
          from: { id: 'igsid-9' },
          media: { id: '17890001' },
        }),
      ).expect(200);
      await deliver(
        comment({
          id: 'c-c',
          text: 'link',
          from: { id: account },
          media: { id: '17890001' },
        }),
      ).expect(200);
      await deliver(
        comment({
          id: 'c-d',
          text: 'link SPAM',
          from: { id: 'igsid-9' },
          media: { id: '17890001' },
        }),
      ).expect(200);
      await deliver(
        comment({
          id: 'c-e',
          parent_id: 'c-root',
          text: 'link',
          from: { id: 'igsid-9' },
          media: { id: '17890001' },
        }),
      ).expect(200);

      expect(instagram.sendMessage).not.toHaveBeenCalled();
      expect(instagram.replyToComment).not.toHaveBeenCalled();
    });
  });
});
