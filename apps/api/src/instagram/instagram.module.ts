import { Module } from '@nestjs/common';
import { FlowRunner } from './flow-runner.service.js';
import { InstagramClient } from './instagram.client.js';
import { InstagramConfig } from './instagram.config.js';
import { InstagramSignatureGuard } from './instagram-signature.guard.js';
import { InstagramWebhookController } from './instagram-webhook.controller.js';
import { InstagramWebhookService } from './instagram-webhook.service.js';

@Module({
  controllers: [InstagramWebhookController],
  providers: [
    InstagramConfig,
    InstagramClient,
    InstagramSignatureGuard,
    InstagramWebhookService,
    FlowRunner,
  ],
})
export class InstagramModule {}
