# @message-automation/api

Backend of the monorepo (see the root `CLAUDE.md`). ManyChat-style message
automation API. Current scope: creating automations
(flows), editing their draft, publishing them, attaching keyword and comment
triggers, and running live flows on one Instagram account through Meta's
webhooks and Send API. The reference contract captured from ManyChat
(creation lifecycle and the comment trigger widget) is in
`docs/manychat-automation-capture.md` (repo root); the Instagram runtime
research and decisions are in `docs/instagram-runtime.md`.

Paths and commands below are relative to `apps/api/`; run them there, or from
the root with `pnpm --filter @message-automation/api <script>`.

## Stack

NestJS 12 (ESM, `.js` import suffixes), Prisma 7 with `@prisma/adapter-pg`
(Postgres), zod 4 for request validation, vitest + supertest. oxlint and prettier
are installed and configured at the root.

## Layout

- `src/automations/domain/` – pure logic, no Nest/Prisma: zod schemas
  (`draft.schema.ts`, `flow.schema.ts`, `keywords.ts`), publish graph rules
  (`publish-validation.ts`), draft merge (`merge-draft.ts`), `ns` generator,
  comment trigger schema/matcher (`comment-trigger.ts`).
- `src/automations/` – `FlowsController` (all routes under `/flows`),
  `FlowsService` (flow/draft/publish), `KeywordsService`,
  `CommentTriggersService`, `flow.presenter.ts` (DB row → API response).
- `src/instagram/domain/` – pure: webhook parsing (`webhook.ts`), signature
  check, flow message → Graph API message (`outgoing.ts`).
- `src/instagram/` – `InstagramWebhookController` (`/webhooks/instagram`),
  `InstagramSignatureGuard`, `InstagramWebhookService` (dedupe, contacts,
  trigger matching), `FlowRunner` (sends published contents),
  `InstagramClient` (fetch to graph.instagram.com), `InstagramConfig` (env).
- `src/app.setup.ts` – body-parser limit shared by `main.ts` and e2e; the app
  must be created with `rawBody: true`.
- `src/common/zod-validation.pipe.ts` – `@Body(new ZodValidationPipe(schema))`;
  400 body is `{message: 'Validation failed', issues[{path, message}]}`.
- `src/prisma/` – global `PrismaService`.
- `src/generated/prisma/` – generated client (gitignored, `pnpm exec prisma generate`).

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/flows` | `{name, path?}` → 201 flow (`status: draft`) |
| GET | `/flows?path=/` | summaries with `triggers`, newest first |
| GET | `/flows/:ns` | flow with draft, published contents, triggers |
| PATCH | `/flows/:ns` | `{name}` rename |
| DELETE | `/flows/:ns` | 204; deletes contents and triggers too (no trash) |
| PUT | `/flows/:ns/draft` | full draft `{rootContent, contents[], coordinates}` |
| PATCH | `/flows/:ns/draft` | upsert contents/coordinates by oid |
| POST | `/flows/:ns/publish` | 200 live flow; 422 `{errors[]}` bad graph; 409 no draft |
| POST | `/flows/:ns/keywords` | `{channel, keywordRules[{condition, keywords[]}], name?, sort?}`; 409 `{conflicts[]}` |
| PUT, DELETE | `/flows/:ns/keywords/:ruleId` | replace (same body as POST, conflicts ignore the rule itself) / 204; 404 if the rule is not this flow's |
| POST | `/flows/:ns/comment-triggers` | `{mediaIds[]?, includeKeywords[]?, excludeKeywords[]?, rootCommentsOnly?, publicReplies[]?, name?, sort?}`; empty = any post / any comment |
| PUT, DELETE | `/flows/:ns/comment-triggers/:triggerId` | replace / 204 |
| GET | `/webhooks/instagram` | Meta handshake; 403 on wrong verify token |
| POST | `/webhooks/instagram` | signed Meta delivery → `{received}`; 403 bad signature, 503 not configured |

## Patterns

- Drafts accept incomplete graphs; graph rules run only on publish.
- Published contents are upserted by `(flowId, oid)` so `contentId` stays
  stable; contents missing from the new draft are soft-deleted.
- `flow.draft === null` means "no unpublished changes".
- Json columns are written only after zod validation, then read back with a
  type cast in `flow.presenter.ts`.
- Runtime only reads published contents of `live` flows. Button postback
  payload is `content:<contentId>`.
- Webhook events are claimed in `InboundEvent` by key before handling; a
  failing event is logged and skipped so the delivery still gets 200.
- Instagram limits (640 chars with buttons, 1000 bytes otherwise) are checked
  on publish, not on draft.

## Environment

- `DATABASE_URL` – app database. `TEST_DATABASE_URL` – e2e database; the e2e
  global setup runs `prisma migrate deploy` on it and points the app at it.
- `.env` lives in `apps/api/`. `main.ts`, `prisma7.config.ts` and the e2e
  setup read it from the working directory, so start the app and run Prisma
  from `apps/api/` (pnpm scripts already do).
- `main.ts` loads `.env` with `process.loadEnvFile()` when the file exists.
- `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN` (Instagram user token),
  `INSTAGRAM_APP_SECRET`, `INSTAGRAM_VERIFY_TOKEN`; optional
  `INSTAGRAM_GRAPH_URL` (default `https://graph.instagram.com/v26.0`). Without
  the four, the webhook answers 403/503. e2e overrides `InstagramConfig` and
  `InstagramClient`, so it needs none of them.

Local databases (no Docker in this WSL): two `prisma dev` servers.

```bash
pnpm exec prisma dev -n message-automation --detach        # dev, :51214
pnpm exec prisma dev -n message-automation-test --detach   # e2e, :51218
pnpm exec prisma dev ls
```

## Checks (run all before calling a change done)

```bash
pnpm lint        # root config .oxlintrc.json
pnpm --dir ../.. format:check
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
- **Prisma config file is `prisma7.config.ts`**: the CLI loads it from the
  working directory, so Prisma commands only work from `apps/api/`.

## Known gaps

- No authentication or account/page scoping yet (ManyChat scopes everything
  by `pageId`); every route is public.
- Keyword conflict check is read-then-write, so two concurrent creates can
  both pass. Needs a unique index on a normalized keyword table or a
  serializable transaction.
- `src/app.module.ts` still has placeholder `ObserveModule` keys.
- One Instagram account per deployment (env), no OAuth/account table.
- Webhook sends inline before answering Meta; no queue, no retry of failed
  sends, no 24 h window check. Keyword rules and comment triggers are loaded
  in full per event.
