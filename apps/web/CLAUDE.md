# @message-automation/web

Front-end of the monorepo (see the root `CLAUDE.md`): ManyChat's Instagram
automation screens rebuilt on top of `apps/api`. The ManyChat UI it follows
was observed on 2026-10-20; what was observed and what was decided here is in
`docs/manychat-automation-capture.md` ("Third capture: editor UI").

Paths and commands below are relative to `apps/web/`.

## Stack

React 19, Vite 8, TypeScript 6, React Router 8 (`BrowserRouter`), TanStack
Query 5, React Flow 12 (`@xyflow/react`) for the canvas, Tailwind CSS 4
(`@tailwindcss/vite`, tokens in `src/index.css` `@theme`), lucide-react
icons, vitest + Testing Library (jsdom).

## Layout

- `src/api/` – `types.ts` (hand-written mirror of the API responses),
  `client.ts` (`api()` fetch wrapper, `ApiError` with the 400/409/422 lists),
  `flows.ts` (query keys, `flowsApi`, hooks; trigger mutations patch the
  cached flow instead of refetching it).
- `src/editor/` – the flow builder.
  - `model.ts` – pure draft operations (build the draft from a flow, add /
    remove / duplicate steps, `connect` source handles, canvas edges, publish
    error wording). Everything that changes the draft goes through it.
  - `history.ts` – undo/redo over whole drafts.
  - `useFlowEditor.ts` – draft state, autosave (PUT `/draft` 700 ms after the
    last change), view/edit mode, publish.
  - `FlowCanvas.tsx` – React Flow wiring; `nodes/` (trigger and step nodes),
    `panels/` (left sidebar panels, button editor, trigger picker).
  - `limits.ts` – the API's limits (text 1000 bytes / 640 chars with buttons,
    caption 20, 3 buttons...).
- `src/pages/` – `AutomationsPage` (list) and `FlowEditorPage` (lazy loaded).
- `src/lib/` – trigger descriptions and filters, relative dates.

## Patterns

- The draft is the editor's single source of truth. React Flow keeps its own
  copy of nodes and edges for dragging; they are rebuilt from the draft, and
  every real change goes back through `editor.change(update, key?)`. The key
  merges quick edits of one field into one undo step.
- The editor reads `flow.draft` (or the published contents) once, on mount;
  later refetches never overwrite local edits. A brand-new flow saves its
  initial draft (one empty step) right away, so it can be published.
- A live flow without a draft opens read-only ("Você está visualizando uma
  versão publicada"); "Editar Automação" switches to edit mode.
- Triggers are their own resources (POST/PUT/DELETE right away), not part of
  the draft, like ManyChat's `keywords/create` and growth-tool widgets.
- The trigger node's position is stored in `draft.coordinates.trigger`.
- Source handle ids: `next` (trigger "Então" and step "Próximo Passo") and
  `button:<messageOid>:<buttonOid>`; `parseSourceHandle` maps them back.
- The button editor keeps its fields locally until "Concluído", so an
  unfinished URL never reaches the draft (the API would reject the save).
- UI text is Brazilian Portuguese, following ManyChat's pt-BR editor.

## Environment

- Dev server on :5173 proxies `/api/*` to `http://localhost:3000` (override
  with `API_URL`), because the API has no CORS. A build calls `/api` on its
  own origin, or `VITE_API_URL`.

## Checks

From the root: `pnpm format:check`, `pnpm lint`, `pnpm test`, `pnpm build`.
Here: `pnpm test`, `pnpm lint`, `pnpm build` (runs `tsc --noEmit` first).

## Known gaps

- Types are copied from the API by hand; they should move to a shared
  `packages/` library with the zod schemas.
- No post picker for comment triggers (the API has no media listing): media
  ids are typed in. "Next post", story replies and the other ManyChat
  triggers are listed as "Em breve".
- No metrics, preview ("Visualização"), templates, folders, trash or
  "Reverter para publicado" (the API has no discard-draft route).
- Only text messages (no images, quick replies or the per-step "send inside
  the messaging window" option).
