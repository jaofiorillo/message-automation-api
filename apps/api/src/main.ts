import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureApp } from './app.setup.js';

// Prisma 7 no longer loads .env on its own; real environments set the vars.
if (existsSync('.env')) process.loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
    rawBody: true,
  });
  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
