import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  draftPatchSchema,
  draftSchema,
  type Draft,
  type DraftPatch,
} from './domain/draft.schema.js';
import {
  createFlowSchema,
  flowPathSchema,
  type CreateFlowInput,
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
}
