import { Injectable } from '@nestjs/common';

// One connected Instagram professional account, configured by environment.
// Empty values leave the webhook disabled instead of failing app startup.
@Injectable()
export class InstagramConfig {
  readonly accountId = process.env.INSTAGRAM_ACCOUNT_ID ?? '';
  readonly accessToken = process.env.INSTAGRAM_ACCESS_TOKEN ?? '';
  readonly appSecret = process.env.INSTAGRAM_APP_SECRET ?? '';
  readonly verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN ?? '';
  readonly graphUrl =
    process.env.INSTAGRAM_GRAPH_URL ?? 'https://graph.instagram.com/v26.0';

  get isConfigured(): boolean {
    return [
      this.accountId,
      this.accessToken,
      this.appSecret,
      this.verifyToken,
    ].every((value) => value !== '');
  }
}
