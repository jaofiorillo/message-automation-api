import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CommentTriggersService } from './comment-triggers.service.js';
import {
  commentTriggerInputSchema,
  type CommentTriggerInput,
} from './domain/comment-trigger.js';
import {
  draftPatchSchema,
  draftSchema,
  type Draft,
  type DraftPatch,
} from './domain/draft.schema.js';
import {
  createFlowSchema,
  flowPathSchema,
  updateFlowSchema,
  type CreateFlowInput,
  type UpdateFlowInput,
} from './domain/flow.schema.js';
import {
  keywordRuleInputSchema,
  type KeywordRuleInput,
} from './domain/keywords.js';
import { FlowsService } from './flows.service.js';
import { KeywordsService } from './keywords.service.js';

@Controller('flows')
export class FlowsController {
  constructor(
    private readonly flows: FlowsService,
    private readonly keywords: KeywordsService,
    private readonly commentTriggers: CommentTriggersService,
  ) {}

  @Post()
  create(@Body(new ZodValidationPipe(createFlowSchema)) body: CreateFlowInput) {
    return this.flows.create(body);
  }

  @Get()
  list(
    @Query('path', new ZodValidationPipe(flowPathSchema.default('/')))
    path: string,
  ) {
    return this.flows.list(path);
  }

  @Get(':ns')
  get(@Param('ns') ns: string) {
    return this.flows.get(ns);
  }

  @Patch(':ns')
  update(
    @Param('ns') ns: string,
    @Body(new ZodValidationPipe(updateFlowSchema)) body: UpdateFlowInput,
  ) {
    return this.flows.update(ns, body);
  }

  @Delete(':ns')
  @HttpCode(204)
  remove(@Param('ns') ns: string) {
    return this.flows.remove(ns);
  }

  @Put(':ns/draft')
  setDraft(
    @Param('ns') ns: string,
    @Body(new ZodValidationPipe(draftSchema)) body: Draft,
  ) {
    return this.flows.setDraft(ns, body);
  }

  @Patch(':ns/draft')
  patchDraft(
    @Param('ns') ns: string,
    @Body(new ZodValidationPipe(draftPatchSchema)) body: DraftPatch,
  ) {
    return this.flows.patchDraft(ns, body);
  }

  @Post(':ns/publish')
  @HttpCode(200)
  publish(@Param('ns') ns: string) {
    return this.flows.publish(ns);
  }

  @Post(':ns/keywords')
  createKeyword(
    @Param('ns') ns: string,
    @Body(new ZodValidationPipe(keywordRuleInputSchema)) body: KeywordRuleInput,
  ) {
    return this.keywords.create(ns, body);
  }

  @Put(':ns/keywords/:ruleId')
  updateKeyword(
    @Param('ns') ns: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
    @Body(new ZodValidationPipe(keywordRuleInputSchema)) body: KeywordRuleInput,
  ) {
    return this.keywords.update(ns, ruleId, body);
  }

  @Delete(':ns/keywords/:ruleId')
  @HttpCode(204)
  removeKeyword(
    @Param('ns') ns: string,
    @Param('ruleId', ParseIntPipe) ruleId: number,
  ) {
    return this.keywords.remove(ns, ruleId);
  }

  @Post(':ns/comment-triggers')
  createCommentTrigger(
    @Param('ns') ns: string,
    @Body(new ZodValidationPipe(commentTriggerInputSchema))
    body: CommentTriggerInput,
  ) {
    return this.commentTriggers.create(ns, body);
  }

  @Put(':ns/comment-triggers/:triggerId')
  updateCommentTrigger(
    @Param('ns') ns: string,
    @Param('triggerId', ParseIntPipe) triggerId: number,
    @Body(new ZodValidationPipe(commentTriggerInputSchema))
    body: CommentTriggerInput,
  ) {
    return this.commentTriggers.update(ns, triggerId, body);
  }

  @Delete(':ns/comment-triggers/:triggerId')
  @HttpCode(204)
  removeCommentTrigger(
    @Param('ns') ns: string,
    @Param('triggerId', ParseIntPipe) triggerId: number,
  ) {
    return this.commentTriggers.remove(ns, triggerId);
  }
}
