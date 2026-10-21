import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // e2e specs share one database, so run files one after another.
    fileParallelism: false,
    globalSetup: ['./test/global-setup.ts'],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
  },
});
