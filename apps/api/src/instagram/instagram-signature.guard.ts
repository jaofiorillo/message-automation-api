import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { isValidSignature } from './domain/signature.js';
import { InstagramConfig } from './instagram.config.js';

// Rejects webhook deliveries not signed with the app secret. Needs the app to
// be created with `rawBody: true`.
@Injectable()
export class InstagramSignatureGuard implements CanActivate {
  constructor(private readonly config: InstagramConfig) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.config.isConfigured) {
      throw new ServiceUnavailableException('Instagram is not configured');
    }
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const signature = request.headers['x-hub-signature-256'];
    if (
      !request.rawBody ||
      typeof signature !== 'string' ||
      !isValidSignature(request.rawBody, signature, this.config.appSecret)
    ) {
      throw new ForbiddenException('Invalid signature');
    }
    return true;
  }
}
