import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  draftSchema,
  type Draft,
  type DraftPatch,
} from './domain/draft.schema.js';
import type { CreateFlowInput } from './domain/flow.schema.js';
import { mergeDraft } from './domain/merge-draft.js';
import { generateNs } from './domain/ns.js';
import { findPublishErrors } from './domain/publish-validation.js';
import { presentFlow, presentFlowSummary } from './flow.presenter.js';

const withRelations = {
  contents: { orderBy: { id: 'asc' } },
  keywordRules: { orderBy: [{ sort: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.FlowInclude;

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateFlowInput) {
    const flow = await this.prisma.flow.create({
      data: { ns: generateNs(), name: input.name, path: input.path },
      include: withRelations,
    });
    return presentFlow(flow);
  }

  async list(path: string) {
    const flows = await this.prisma.flow.findMany({
      where: { path },
      orderBy: { id: 'desc' },
    });
    return flows.map(presentFlowSummary);
  }

  async get(ns: string) {
    return presentFlow(await this.findOrFail(ns));
  }

  // flow/setDraft: replaces the whole editor state.
  async setDraft(ns: string, draft: Draft) {
    await this.findOrFail(ns);
    return this.saveDraft(ns, draft);
  }

  // flow/patchDraft: upserts contents and coordinates into the current draft.
  async patchDraft(ns: string, patch: DraftPatch) {
    const flow = await this.findOrFail(ns);
    return this.saveDraft(ns, mergeDraft(flow.draft as Draft | null, patch));
  }

  // flow/publish: validates the draft graph and materializes it as contents
  // with server ids. Contents are matched by oid so their ids stay stable.
  async publish(ns: string) {
    const flow = await this.findOrFail(ns);
    if (flow.draft === null) {
      throw new ConflictException('Flow has no unpublished changes');
    }

    const draft = draftSchema.parse(flow.draft);
    const errors = findPublishErrors(draft);
    if (errors.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Flow cannot be published',
        errors,
      });
    }

    const active = draft.contents.filter((content) => !content.removed);
    const published = await this.prisma.$transaction(async (tx) => {
      const ids = new Map<string, number>();
      for (const content of active) {
        const fields = {
          type: content.type,
          caption: content.caption,
          targetOid: content.targetOid,
          data: { messages: content.messages },
          deleted: false,
        };
        const row = await tx.flowContent.upsert({
          where: { flowId_oid: { flowId: flow.id, oid: content.oid } },
          create: { flowId: flow.id, oid: content.oid, ...fields },
          update: fields,
        });
        ids.set(content.oid, row.id);
      }

      await tx.flowContent.updateMany({
        where: { flowId: flow.id, oid: { notIn: [...ids.keys()] } },
        data: { deleted: true },
      });

      return tx.flow.update({
        where: { id: flow.id },
        data: {
          status: 'live',
          draft: Prisma.DbNull,
          coordinates: draft.coordinates,
          rootContentId: ids.get(draft.rootContent),
          publishedAt: new Date(),
        },
        include: withRelations,
      });
    });

    return presentFlow(published);
  }

  async findOrFail(ns: string) {
    const flow = await this.prisma.flow.findUnique({
      where: { ns },
      include: withRelations,
    });
    if (!flow) throw new NotFoundException(`Flow "${ns}" not found`);
    return flow;
  }

  private async saveDraft(ns: string, draft: Draft) {
    const flow = await this.prisma.flow.update({
      where: { ns },
      data: { draft },
      include: withRelations,
    });
    return presentFlow(flow);
  }
}
