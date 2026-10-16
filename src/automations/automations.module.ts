import { Module } from '@nestjs/common';
import { FlowsController } from './flows.controller.js';
import { FlowsService } from './flows.service.js';
import { KeywordsService } from './keywords.service.js';

@Module({
  controllers: [FlowsController],
  providers: [FlowsService, KeywordsService],
})
export class AutomationsModule {}
