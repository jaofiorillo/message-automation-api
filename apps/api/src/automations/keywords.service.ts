import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    await this.assertNoConflicts(input.channel, keywordRules);

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

  // Replaces the rule's keywords; the rule itself is not checked against its
  // own previous keywords.
  async update(ns: string, ruleId: number, input: KeywordRuleInput) {
    const flow = await this.flows.findOrFail(ns);
    const current = await this.findRuleOrFail(flow.id, ruleId);
    const keywordRules = normalizeKeywordRules(input.keywordRules);
    await this.assertNoConflicts(input.channel, keywordRules, ruleId);

    const rule = await this.prisma.keywordRule.update({
      where: { id: ruleId },
      data: {
        name: input.name ?? current.name,
        channel: input.channel,
        sort: input.sort,
        keywordRules,
      },
    });
    return presentKeywordRule(rule, ns);
  }

  async remove(ns: string, ruleId: number) {
    const flow = await this.flows.findOrFail(ns);
    await this.findRuleOrFail(flow.id, ruleId);
    await this.prisma.keywordRule.delete({ where: { id: ruleId } });
  }

  private async findRuleOrFail(flowId: number, ruleId: number) {
    const rule = await this.prisma.keywordRule.findFirst({
      where: { id: ruleId, flowId },
    });
    if (!rule) throw new NotFoundException(`Keyword rule ${ruleId} not found`);
    return rule;
  }

  private async assertNoConflicts(
    channel: KeywordRuleInput['channel'],
    keywordRules: KeywordGroup[],
    exceptRuleId?: number,
  ) {
    const existing = await this.prisma.keywordRule.findMany({
      where: { channel, id: exceptRuleId ? { not: exceptRuleId } : undefined },
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
  }
}
