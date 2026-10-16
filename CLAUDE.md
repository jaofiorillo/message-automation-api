# message-automation-api

ManyChat-style message automation backend. Current scope: creating automations
(flows), editing their draft, publishing them and attaching keyword triggers.
Running automations against real channels is not built yet. The reference
contract captured from ManyChat is in `docs/manychat-automation-capture.md`.

## Stack

NestJS 12 (ESM, `.js` import suffixes), Prisma 7 with `@prisma/adapter-pg`
(Postgres), zod 4 for request validation, vitest + supertest, oxlint,
prettier, pnpm 12, Node 24 (nvm).

## Layout

- `src/automations/domain/` – pure logic, no Nest/Prisma: zod schemas
  (`draft.schema.ts`, `flow.schema.ts`, `keywords.ts`), publish graph rules
  (`publish-validation.ts`), draft merge (`merge-draft.ts`), `ns` generator.
- `src/automations/` – `FlowsController` (all routes under `/flows`),
  `FlowsService` (flow/draft/publish), `KeywordsService`, `flow.presenter.ts`
  (DB row → API response).
- `src/common/zod-validation.pipe.ts` – `@Body(new ZodValidationPipe(schema))`;
  400 body is `{message: 'Validation failed', issues[{path, message}]}`.
- `src/prisma/` – global `PrismaService`.
- `src/generated/prisma/` – generated client (gitignored, `pnpm exec prisma generate`).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/flows` | `{name, path?}` → 201 flow (`status: draft`) |
| GET | `/flows?path=/` | summaries, newest first |
| GET | `/flows/:ns` | flow with draft, published contents, triggers |
| PUT | `/flows/:ns/draft` | full draft `{rootContent, contents[], coordinates}` |
| PATCH | `/flows/:ns/draft` | upsert contents/coordinates by oid |
| POST | `/flows/:ns/publish` | 200 live flow; 422 `{errors[]}` bad graph; 409 no draft |
| POST | `/flows/:ns/keywords` | `{channel, keywordRules[{condition, keywords[]}], name?, sort?}`; 409 `{conflicts[]}` |

## Patterns

- Drafts accept incomplete graphs; graph rules run only on publish.
- Published contents are upserted by `(flowId, oid)` so `contentId` stays
  stable; contents missing from the new draft are soft-deleted.
- `flow.draft === null` means "no unpublished changes".
- Json columns are written only after zod validation, then read back with a
  type cast in `flow.presenter.ts`.

## Environment

- `DATABASE_URL` – app database. `TEST_DATABASE_URL` – e2e database; the e2e
  global setup runs `prisma migrate deploy` on it and points the app at it.
- `main.ts` loads `.env` with `process.loadEnvFile()` when the file exists.

Local databases (no Docker in this WSL): two `prisma dev` servers.

```bash
pnpm exec prisma dev -n message-automation --detach        # dev, :51214
pnpm exec prisma dev -n message-automation-test --detach   # e2e, :51218
pnpm exec prisma dev ls
```

## Checks (run all before calling a change done)

```bash
pnpm exec prettier --check "src/**/*.ts" "test/**/*.ts"
pnpm lint
pnpm audit --prod
pnpm test        # unit, no DB
pnpm test:e2e    # needs the test prisma dev server
pnpm build
```

## Hurdles

- **`prisma migrate dev` fails on `prisma dev`**: its shadow database is not
  clean (`type "FlowStatus" already exists`). Create migrations with
  `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<ts>_<name>/migration.sql`
  and apply with `prisma migrate deploy`.
- **Prisma blocks `migrate reset` from AI agents** without explicit user
  consent. Prefer additive migrations.
- **Prisma client must live under `src/`**: `tsconfig.build.json` has
  `rootDir: ./src`, so a client outside it breaks `nest build`.
- **pnpm build scripts**: `pnpm-workspace.yaml` `allowBuilds` must list
  `prisma` and `@prisma/engines` as `true`.
- **Shell Node**: non-interactive shells need `source ~/.nvm/nvm.sh`, or the
  Windows Node from `/mnt/c` is picked up.

## Known gaps

- No authentication or account/page scoping yet (ManyChat scopes everything
  by `pageId`); every route is public.
- Keyword conflict check is read-then-write, so two concurrent creates can
  both pass. Needs a unique index on a normalized keyword table or a
  serializable transaction.
- `src/app.module.ts` still has placeholder `ObserveModule` keys.
