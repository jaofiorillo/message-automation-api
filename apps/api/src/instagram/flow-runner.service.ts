import { Injectable } from '@nestjs/common';
import type { FlowContent } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DraftContent } from '../automations/domain/draft.schema.js';
import {
  parseContentPayload,
  toInstagramMessage,
  type InstagramRecipient,
} from './domain/outgoing.js';
import { InstagramClient } from './instagram.client.js';

// Contents chained by `targetOid` are sent in one go; this caps a chain that
// loops back on itself. Loops through buttons are fine: each needs a tap.
const maxContentsPerRun = 10;

// Sends the published version of a flow. Drafts are never run.
@Injectable()
export class FlowRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly instagram: InstagramClient,
  ) {}

  // Starts a live flow at its root content. Returns how many messages went out.
  async startFlow(
    flow: { id: number; rootContentId: number | null },
    recipient: InstagramRecipient,
  ): Promise<number> {
    if (flow.rootContentId === null) return 0;
    return this.run(flow.id, flow.rootContentId, recipient);
  }

  // Continues a conversation from a button postback (`content:<id>`).
  async runFromPayload(payload: string, senderId: string): Promise<number> {
    const contentId = parseContentPayload(payload);
    if (contentId === null) return 0;
    const content = await this.prisma.flowContent.findFirst({
      where: { id: contentId, deleted: false, flow: { status: 'live' } },
      select: { flowId: true },
    });
    if (!content) return 0;
    return this.run(content.flowId, contentId, { id: senderId });
  }

  private async run(
    flowId: number,
    startContentId: number,
    recipient: InstagramRecipient,
  ): Promise<number> {
    const contents = await this.prisma.flowContent.findMany({
      where: { flowId, deleted: false },
    });
    const byOid = new Map(contents.map((content) => [content.oid, content]));
    const ids = new Map(contents.map((content) => [content.oid, content.id]));

    let current: FlowContent | undefined = contents.find(
      (content) => content.id === startContentId,
    );
    let sent = 0;
    for (let step = 0; current && step < maxContentsPerRun; step++) {
      const { messages } = current.data as {
        messages: DraftContent['messages'];
      };
      for (const message of messages) {
        await this.instagram.sendMessage(
          recipient,
          toInstagramMessage(message, ids),
        );
        sent++;
        // A private reply allows a single message until the commenter
        // answers, so a comment run stops after the first one.
        if ('comment_id' in recipient) return sent;
      }
      current = current.targetOid ? byOid.get(current.targetOid) : undefined;
    }
    return sent;
  }
}
