import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

function draftBody() {
  return {
    rootContent: 'c1',
    contents: [
      {
        oid: 'c1',
        type: 'message',
        caption: 'Boas-vindas',
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
      },
    ],
    coordinates: { c1: { x: 0, y: 0 }, c2: { x: 400, y: 0 } },
  };
}

describe('Automations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.flow.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function createFlow(name = 'Keyword oi') {
    const res = await http().post('/flows').send({ name }).expect(201);
    return res.body.ns as string;
  }

  async function publishedFlow() {
    const ns = await createFlow();
    await http().put(`/flows/${ns}/draft`).send(draftBody()).expect(200);
    const res = await http().post(`/flows/${ns}/publish`).expect(200);
    return { ns, flow: res.body };
  }

  describe('POST /flows', () => {
    it('creates an empty draft flow', async () => {
      const res = await http()
        .post('/flows')
        .send({ name: 'Keyword oi' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Keyword oi',
        path: '/',
        status: 'draft',
        rootContentId: null,
        hasUnpublishedChanges: false,
        draft: null,
        contents: [],
        triggers: { keywords: [] },
      });
      expect(res.body.ns).toMatch(/^content\d{14}_\d{6}$/);
    });

    it('rejects a missing name', async () => {
      const res = await http().post('/flows').send({}).expect(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.issues[0].path).toEqual(['name']);
    });

    it('rejects a path that does not start with /', async () => {
      await http()
        .post('/flows')
        .send({ name: 'x', path: '../etc' })
        .expect(400);
    });
  });

  describe('GET /flows', () => {
    it('lists flows in a folder, newest first', async () => {
      await createFlow('first');
      await createFlow('second');
      await http().post('/flows').send({ name: 'other', path: '/promo' });

      const res = await http().get('/flows').query({ path: '/' }).expect(200);
      expect(res.body.map((flow: { name: string }) => flow.name)).toEqual([
        'second',
        'first',
      ]);
    });

    it('includes the triggers of each flow', async () => {
      const ns = await createFlow();
      await http()
        .post(`/flows/${ns}/comment-triggers`)
        .send({ includeKeywords: ['link'] })
        .expect(201);

      const res = await http().get('/flows').expect(200);
      expect(res.body[0].triggers).toMatchObject({
        keywords: [],
        comments: [{ includeKeywords: ['link'] }],
      });
    });
  });

  describe('PATCH /flows/:ns and DELETE /flows/:ns', () => {
    it('renames a flow', async () => {
      const ns = await createFlow();
      const res = await http()
        .patch(`/flows/${ns}`)
        .send({ name: '  Novo nome ' })
        .expect(200);
      expect(res.body.name).toBe('Novo nome');
    });

    it('rejects a blank name', async () => {
      const ns = await createFlow();
      await http().patch(`/flows/${ns}`).send({ name: ' ' }).expect(400);
    });

    it('deletes a flow with its triggers', async () => {
      const ns = await createFlow();
      await http()
        .post(`/flows/${ns}/keywords`)
        .send({
          channel: 'instagram',
          keywordRules: [{ condition: 'is', keywords: ['oi'] }],
        })
        .expect(201);

      await http().delete(`/flows/${ns}`).expect(204);
      await http().get(`/flows/${ns}`).expect(404);
      expect(await prisma.keywordRule.count()).toBe(0);
    });
  });

  describe('GET /flows/:ns', () => {
    it('returns 404 for an unknown flow', async () => {
      await http().get('/flows/content00000000000000_000000').expect(404);
    });
  });

  describe('drafts', () => {
    it('stores a full draft with PUT', async () => {
      const ns = await createFlow();
      const res = await http()
        .put(`/flows/${ns}/draft`)
        .send(draftBody())
        .expect(200);

      expect(res.body.hasUnpublishedChanges).toBe(true);
      expect(res.body.draft.rootContent).toBe('c1');
      expect(res.body.draft.coordinates.c2).toEqual({ x: 400, y: 0 });
      expect(res.body.status).toBe('draft');
    });

    it('rejects a draft with an unsafe button url', async () => {
      const ns = await createFlow();
      const body = draftBody();
      (body.contents[1].messages[0].buttons[0] as { url: string }).url =
        'javascript:alert(1)';
      await http().put(`/flows/${ns}/draft`).send(body).expect(400);
    });

    it('merges a partial draft with PATCH', async () => {
      const ns = await createFlow();
      await http().put(`/flows/${ns}/draft`).send(draftBody()).expect(200);

      const res = await http()
        .patch(`/flows/${ns}/draft`)
        .send({
          contents: [
            {
              oid: 'c2',
              type: 'message',
              messages: [{ oid: 'm2', type: 'text', text: 'Novo texto' }],
            },
          ],
          coordinates: { c2: { x: 500, y: 50 } },
        })
        .expect(200);

      const c2 = res.body.draft.contents.find(
        (content: { oid: string }) => content.oid === 'c2',
      );
      expect(c2.messages[0].text).toBe('Novo texto');
      expect(res.body.draft.contents).toHaveLength(2);
      expect(res.body.draft.coordinates).toEqual({
        c1: { x: 0, y: 0 },
        c2: { x: 500, y: 50 },
      });
    });

    it('returns 404 when saving a draft for an unknown flow', async () => {
      await http()
        .put('/flows/content00000000000000_000000/draft')
        .send(draftBody())
        .expect(404);
    });
  });

  describe('POST /flows/:ns/publish', () => {
    it('materializes contents with server ids and goes live', async () => {
      const { flow } = await publishedFlow();

      expect(flow.status).toBe('live');
      expect(flow.draft).toBeNull();
      expect(flow.hasUnpublishedChanges).toBe(false);
      expect(flow.publishedAt).toEqual(expect.any(String));
      expect(flow.contents).toHaveLength(2);
      for (const content of flow.contents) {
        expect(content.contentId).toEqual(expect.any(Number));
      }
      const root = flow.contents.find(
        (content: { oid: string }) => content.oid === 'c1',
      );
      expect(flow.rootContentId).toBe(root.contentId);
      expect(root.messages[0].buttons[0].targetOid).toBe('c2');
      expect(flow.coordinates.c1).toEqual({ x: 0, y: 0 });
    });

    it('keeps content ids stable and drops removed contents on republish', async () => {
      const { ns, flow } = await publishedFlow();
      const ids = Object.fromEntries(
        flow.contents.map((c: { oid: string; contentId: number }) => [
          c.oid,
          c.contentId,
        ]),
      );

      const body = draftBody();
      body.contents[0].messages[0].buttons = [];
      (body.contents[1] as { removed?: boolean }).removed = true;
      await http().put(`/flows/${ns}/draft`).send(body).expect(200);
      const res = await http().post(`/flows/${ns}/publish`).expect(200);

      expect(res.body.contents).toHaveLength(1);
      expect(res.body.contents[0].contentId).toBe(ids.c1);
      expect(res.body.rootContentId).toBe(ids.c1);
    });

    it('refuses an invalid graph with the list of problems', async () => {
      const ns = await createFlow();
      const body = draftBody();
      (
        body.contents[0].messages[0].buttons[0] as { targetOid: string }
      ).targetOid = 'ghost';
      await http().put(`/flows/${ns}/draft`).send(body).expect(200);

      const res = await http().post(`/flows/${ns}/publish`).expect(422);
      expect(res.body.errors).toEqual([
        'Button "b1" targets missing content "ghost"',
      ]);

      const after = await http().get(`/flows/${ns}`).expect(200);
      expect(after.body.status).toBe('draft');
      expect(after.body.hasUnpublishedChanges).toBe(true);
    });

    it('returns 409 when there is nothing to publish', async () => {
      const ns = await createFlow();
      await http().post(`/flows/${ns}/publish`).expect(409);
    });
  });

  describe('keyword triggers', () => {
    const trigger = {
      channel: 'instagram',
      keywordRules: [{ condition: 'is', keywords: ['Oi', 'olá'] }],
    };

    it('creates a keyword rule linked to the flow', async () => {
      const ns = await createFlow('Boas-vindas');
      const res = await http()
        .post(`/flows/${ns}/keywords`)
        .send(trigger)
        .expect(201);

      expect(res.body).toMatchObject({
        ruleId: expect.any(Number),
        ns,
        name: 'Boas-vindas',
        channel: 'instagram',
        sort: 0,
        keywordRules: [{ condition: 'is', keywords: ['oi', 'olá'] }],
      });

      const flow = await http().get(`/flows/${ns}`).expect(200);
      expect(flow.body.triggers.keywords).toEqual([res.body]);
    });

    it('rejects a keyword already used on the same channel', async () => {
      const first = await createFlow('first');
      const second = await createFlow('second');
      await http().post(`/flows/${first}/keywords`).send(trigger).expect(201);

      const res = await http()
        .post(`/flows/${second}/keywords`)
        .send({
          channel: 'instagram',
          keywordRules: [{ condition: 'is', keywords: ['OI'] }],
        })
        .expect(409);
      expect(res.body.conflicts).toEqual([
        { ruleId: expect.any(Number), condition: 'is', keyword: 'oi' },
      ]);
    });

    it('allows the same keyword on another channel', async () => {
      const first = await createFlow('first');
      const second = await createFlow('second');
      await http().post(`/flows/${first}/keywords`).send(trigger).expect(201);
      await http()
        .post(`/flows/${second}/keywords`)
        .send({ ...trigger, channel: 'facebook' })
        .expect(201);
    });

    it('rejects an invalid condition', async () => {
      const ns = await createFlow();
      await http()
        .post(`/flows/${ns}/keywords`)
        .send({
          channel: 'instagram',
          keywordRules: [{ condition: 'regex', keywords: ['.*'] }],
        })
        .expect(400);
    });

    it('returns 404 for an unknown flow', async () => {
      await http()
        .post('/flows/content00000000000000_000000/keywords')
        .send(trigger)
        .expect(404);
    });
  });

  describe('editing and removing triggers', () => {
    const keyword = (keywords: string[]) => ({
      channel: 'instagram',
      keywordRules: [{ condition: 'contains', keywords }],
    });

    it('replaces a keyword rule and keeps its own keywords free', async () => {
      const ns = await createFlow();
      const created = await http()
        .post(`/flows/${ns}/keywords`)
        .send(keyword(['link']))
        .expect(201);

      const res = await http()
        .put(`/flows/${ns}/keywords/${created.body.ruleId}`)
        .send(keyword(['link', 'Preço']))
        .expect(200);
      expect(res.body.keywordRules).toEqual([
        { condition: 'contains', keywords: ['link', 'preço'] },
      ]);
    });

    it('rejects an edit that takes a keyword from another rule', async () => {
      const ns = await createFlow();
      await http()
        .post(`/flows/${ns}/keywords`)
        .send(keyword(['link']));
      const other = await http()
        .post(`/flows/${ns}/keywords`)
        .send(keyword(['oi']))
        .expect(201);

      await http()
        .put(`/flows/${ns}/keywords/${other.body.ruleId}`)
        .send(keyword(['LINK']))
        .expect(409);
    });

    it('deletes a keyword rule only through its own flow', async () => {
      const ns = await createFlow();
      const otherNs = await createFlow('other');
      const created = await http()
        .post(`/flows/${ns}/keywords`)
        .send(keyword(['link']))
        .expect(201);

      await http()
        .delete(`/flows/${otherNs}/keywords/${created.body.ruleId}`)
        .expect(404);
      await http()
        .delete(`/flows/${ns}/keywords/${created.body.ruleId}`)
        .expect(204);
      const flow = await http().get(`/flows/${ns}`).expect(200);
      expect(flow.body.triggers.keywords).toEqual([]);
    });

    it('replaces and deletes a comment trigger', async () => {
      const ns = await createFlow();
      const created = await http()
        .post(`/flows/${ns}/comment-triggers`)
        .send({ includeKeywords: ['link'], publicReplies: ['Enviado!'] })
        .expect(201);
      const id = created.body.triggerId;

      const res = await http()
        .put(`/flows/${ns}/comment-triggers/${id}`)
        .send({ mediaIds: ['17890'], excludeKeywords: ['Spam'] })
        .expect(200);
      expect(res.body).toMatchObject({
        triggerId: id,
        mediaIds: ['17890'],
        includeKeywords: [],
        excludeKeywords: ['spam'],
        publicReplies: [],
      });

      await http().delete(`/flows/${ns}/comment-triggers/${id}`).expect(204);
      await http().delete(`/flows/${ns}/comment-triggers/${id}`).expect(404);
    });

    it('rejects a non-numeric trigger id', async () => {
      const ns = await createFlow();
      await http().delete(`/flows/${ns}/comment-triggers/abc`).expect(400);
    });
  });
});
