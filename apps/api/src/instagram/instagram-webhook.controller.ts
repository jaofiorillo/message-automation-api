import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InstagramSignatureGuard } from './instagram-signature.guard.js';
import { InstagramWebhookService } from './instagram-webhook.service.js';
import { InstagramConfig } from './instagram.config.js';

@Controller('webhooks/instagram')
export class InstagramWebhookController {
  constructor(
    private readonly config: InstagramConfig,
    private readonly webhooks: InstagramWebhookService,
  ) {}

  // Subscription handshake from the Meta App Dashboard.
  @Get()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode: unknown,
    @Query('hub.verify_token') token: unknown,
    @Query('hub.challenge') challenge: unknown,
  ): string {
    if (
      !this.config.isConfigured ||
      mode !== 'subscribe' ||
      token !== this.config.verifyToken ||
      typeof challenge !== 'string'
    ) {
      throw new ForbiddenException('Webhook verification failed');
    }
    return challenge;
  }

  @Post()
  @HttpCode(200)
  @UseGuards(InstagramSignatureGuard)
  async receive(@Body() body: unknown) {
    return { received: await this.webhooks.handle(body) };
  }
}
