import { Module } from '@nestjs/common';
import { CommentTriggersService } from './comment-triggers.service.js';
import { FlowsController } from './flows.controller.js';
import { FlowsService } from './flows.service.js';
import { KeywordsService } from './keywords.service.js';

@Module({
  controllers: [FlowsController],
  providers: [FlowsService, KeywordsService, CommentTriggersService],
})
export class AutomationsModule {}
