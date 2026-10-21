import 'dotenv/config';
import { execFileSync } from 'node:child_process';

// Points the e2e run at TEST_DATABASE_URL and applies migrations to it, so the
// suite never touches the development database.
export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Start one with `pnpm exec prisma dev -n message-automation-test --detach` and add it to .env.',
    );
  }
  process.env.DATABASE_URL = url;
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
