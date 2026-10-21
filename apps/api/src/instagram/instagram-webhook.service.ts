import { randomInt } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { matchesComment } from '../automations/domain/comment-trigger.js';
import {
  matchesKeywordGroups,
  type KeywordGroup,
} from '../automations/domain/keywords.js';
import { parseWebhookEvents, type InstagramEvent } from './domain/webhook.js';
import { FlowRunner } from './flow-runner.service.js';
import { InstagramClient } from './instagram.client.js';
import { InstagramConfig } from './instagram.config.js';

const byPriority = [
  { sort: 'asc' },
  { id: 'asc' },
] satisfies Prisma.KeywordRuleOrderByWithRelationInput[];

@Injectable()
export class InstagramWebhookService {
  private readonly logger = new Logger(InstagramWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: InstagramConfig,
    private readonly instagram: InstagramClient,
    private readonly runner: FlowRunner,
  ) {}

  // Handles every event of a delivery. A failing event is logged and skipped:
  // Meta would otherwise retry the whole batch for up to 36 hours.
  async handle(body: unknown): Promise<number> {
    const events = parseWebhookEvents(body, this.config.accountId);
    for (const event of events) {
      try {
        await this.process(event);
      } catch (error) {
        this.logger.error(
          `Failed to handle ${event.key}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return events.length;
  }

  private async process(event: InstagramEvent) {
    if (!(await this.claim(event.key))) return;
    await this.touchContact(event);
    switch (event.kind) {
      case 'message':
        return this.onMessage(event.senderId, event.text);
      case 'postback':
        return this.runner.runFromPayload(event.payload, event.senderId);
      case 'comment':
        return this.onComment(event);
    }
  }

  // DM keyword trigger: the first live rule by (sort, id) wins.
  private async onMessage(senderId: string, text: string) {
    const rules = await this.prisma.keywordRule.findMany({
      where: { channel: 'instagram', flow: { status: 'live' } },
      orderBy: byPriority,
      include: { flow: true },
    });
    const rule = rules.find((candidate) =>
      matchesKeywordGroups(
        text,
        candidate.keywordRules as unknown as KeywordGroup[],
      ),
    );
    if (rule) await this.runner.startFlow(rule.flow, { id: senderId });
  }

  // Comment to DM: private reply with the flow, then an optional public reply.
  private async onComment(event: Extract<InstagramEvent, { kind: 'comment' }>) {
    const triggers = await this.prisma.commentTrigger.findMany({
      where: { flow: { status: 'live' } },
      orderBy: byPriority,
      include: { flow: true },
    });
    const trigger = triggers.find((candidate) =>
      matchesComment(candidate, event),
    );
    if (!trigger) return;

    await this.runner.startFlow(trigger.flow, { comment_id: event.commentId });
    const replies = trigger.publicReplies;
    if (replies.length > 0) {
      const reply = replies[randomInt(replies.length)];
      await this.instagram.replyToComment(event.commentId, reply);
    }
  }

  // Records the event key; false when it was already handled (a retry).
  private async claim(key: string): Promise<boolean> {
    try {
      await this.prisma.inboundEvent.create({ data: { key } });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }

  private async touchContact(event: InstagramEvent) {
    const now = new Date();
    const username = event.kind === 'comment' ? event.username : null;
    await this.prisma.contact.upsert({
      where: {
        channel_externalId: {
          channel: 'instagram',
          externalId: event.senderId,
        },
      },
      create: {
        channel: 'instagram',
        externalId: event.senderId,
        username,
        lastInteractionAt: now,
      },
      update: { lastInteractionAt: now, ...(username ? { username } : {}) },
    });
  }
}
