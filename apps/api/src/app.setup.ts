import type { NestExpressApplication } from '@nestjs/platform-express';

// HTTP setup shared by main.ts and the e2e tests. The app must be created with
// `rawBody: true` so webhook signatures can be checked against the exact bytes.
export function configureApp(app: NestExpressApplication) {
  // Meta batches up to 1000 webhook updates in one delivery, more than the
  // 100kb body-parser default.
  app.useBodyParser('json', { limit: '1mb' });
}
