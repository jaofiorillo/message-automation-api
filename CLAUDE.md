# message-automation

ManyChat-style message automation, as a pnpm workspace monorepo. Each app
keeps its own `CLAUDE.md` with its details; read it before working there.

## Layout

| Path | Package | What |
|---|---|---|
| `apps/api/` | `@message-automation/api` | NestJS backend: flows, triggers, Instagram runtime (`apps/api/CLAUDE.md`) |
| `apps/web/` | `@message-automation/web` | React front-end: automations list and flow builder (`apps/web/CLAUDE.md`) |
| `packages/` | `@message-automation/*` | shared code, empty for now |
| `docs/` | – | ManyChat captures and research, shared by every app |

Root files shared by all workspaces: `pnpm-workspace.yaml` (workspace
globs and `allowBuilds`), `tsconfig.base.json` (strictness and target only),
`.oxlintrc.json`, `.prettierrc`, `.prettierignore`, `.nvmrc`. oxlint and
prettier are root dev dependencies; app-specific tools stay in the app.

## Conventions for new workspaces

- An app goes in `apps/<name>/`, a library in `packages/<name>/`; both are
  named `@message-automation/<name>` and `private: true`.
- A workspace's `tsconfig.json` extends `../../tsconfig.base.json` and sets
  its own module, resolution, JSX and types.
- Every workspace defines the scripts it supports among `build`, `test`,
  `test:e2e` and `lint`, so the root `pnpm -r` scripts reach it. Add a
  `dev:<name>` root script for its dev server, like `dev:api`.
- Depend on another workspace with `"@message-automation/<name>": "workspace:*"`.
- Each app reads its own `.env` from its own directory.

## Commands (from the root)

```bash
pnpm install
pnpm dev              # API and web together
pnpm dev:api          # API on :3000 (watch mode)
pnpm dev:web          # web on :5173, proxies /api to :3000
pnpm build            # all workspaces
pnpm test             # unit tests, all workspaces
pnpm test:e2e         # needs the test database (apps/api/CLAUDE.md)
pnpm lint
pnpm format:check     # or pnpm format
pnpm audit --prod
pnpm --filter @message-automation/api <script>   # one workspace
```

Run all of them before calling a change done.

## Hurdles

- **pnpm build scripts**: `pnpm-workspace.yaml` `allowBuilds` must list
  `prisma` and `@prisma/engines` as `true`.
- **Shell Node**: non-interactive shells need `source ~/.nvm/nvm.sh`, or the
  Windows Node from `/mnt/c` is picked up.
