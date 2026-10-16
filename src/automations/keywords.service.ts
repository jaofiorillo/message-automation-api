import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  findKeywordConflicts,
  normalizeKeywordRules,
  type KeywordGroup,
  type KeywordRuleInput,
} from './domain/keywords.js';
import { presentKeywordRule } from './flow.presenter.js';
import { FlowsService } from './flows.service.js';

@Injectable()
export class KeywordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flows: FlowsService,
  ) {}

  // keywords/create: a trigger that starts the flow identified by `ns`.
  async create(ns: string, input: KeywordRuleInput) {
    const flow = await this.flows.findOrFail(ns);
    const keywordRules = normalizeKeywordRules(input.keywordRules);

    const existing = await this.prisma.keywordRule.findMany({
      where: { channel: input.channel },
      select: { id: true, keywordRules: true },
    });
    const conflicts = findKeywordConflicts(
      keywordRules,
      existing.map((rule) => ({
        id: rule.id,
        keywordRules: rule.keywordRules as unknown as KeywordGroup[],
      })),
    );
    if (conflicts.length > 0) {
      throw new ConflictException({
        message: 'Keyword already used by another rule on this channel',
        conflicts,
      });
    }

    const rule = await this.prisma.keywordRule.create({
      data: {
        flowId: flow.id,
        name: input.name ?? flow.name,
        channel: input.channel,
        sort: input.sort,
        keywordRules,
      },
    });
    return presentKeywordRule(rule, ns);
  }
}
