# message-automation

ManyChat-style message automation. pnpm workspace monorepo.

- `apps/api` – NestJS backend (flows, keyword and comment triggers, Instagram
  webhooks). See `apps/api/CLAUDE.md`.
- `apps/web` – React front-end: automations list and flow builder. See
  `apps/web/CLAUDE.md`.
- `packages/` – shared libraries (to be added).
- `docs/` – ManyChat captures and Instagram research.

```bash
source ~/.nvm/nvm.sh   # Node 24 (.nvmrc)
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill it in
pnpm dev               # API on :3000 and web on http://localhost:5173
```

See `CLAUDE.md` for every command and the conventions for new workspaces.
