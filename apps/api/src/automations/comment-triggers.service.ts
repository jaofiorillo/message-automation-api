import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  normalizeKeywords,
  type CommentTriggerInput,
} from './domain/comment-trigger.js';
import { presentCommentTrigger } from './flow.presenter.js';
import { FlowsService } from './flows.service.js';

function toData(input: CommentTriggerInput) {
  return {
    sort: input.sort,
    mediaIds: [...new Set(input.mediaIds)],
    includeKeywords: normalizeKeywords(input.includeKeywords),
    excludeKeywords: normalizeKeywords(input.excludeKeywords),
    rootCommentsOnly: input.rootCommentsOnly,
    publicReplies: input.publicReplies,
  };
}

@Injectable()
export class CommentTriggersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flows: FlowsService,
  ) {}

  // Several triggers may match the same comment; the runtime picks the first
  // by (sort, id), so there is no conflict check here.
  async create(ns: string, input: CommentTriggerInput) {
    const flow = await this.flows.findOrFail(ns);
    const trigger = await this.prisma.commentTrigger.create({
      data: {
        flowId: flow.id,
        name: input.name ?? flow.name,
        ...toData(input),
      },
    });
    return presentCommentTrigger(trigger, ns);
  }

  // Replaces the whole trigger, like ManyChat's growth-tools/setWidget.
  async update(ns: string, triggerId: number, input: CommentTriggerInput) {
    const flow = await this.flows.findOrFail(ns);
    const current = await this.findTriggerOrFail(flow.id, triggerId);
    const trigger = await this.prisma.commentTrigger.update({
      where: { id: triggerId },
      data: { name: input.name ?? current.name, ...toData(input) },
    });
    return presentCommentTrigger(trigger, ns);
  }

  async remove(ns: string, triggerId: number) {
    const flow = await this.flows.findOrFail(ns);
    await this.findTriggerOrFail(flow.id, triggerId);
    await this.prisma.commentTrigger.delete({ where: { id: triggerId } });
  }

  private async findTriggerOrFail(flowId: number, triggerId: number) {
    const trigger = await this.prisma.commentTrigger.findFirst({
      where: { id: triggerId, flowId },
    });
    if (!trigger) {
      throw new NotFoundException(`Comment trigger ${triggerId} not found`);
    }
    return trigger;
  }
}
