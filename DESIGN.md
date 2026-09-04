# Design notes — dsh-chat-index (v1)

## Product decision (confirmed with user)

- Scope: every user question of the current session + its branch (subagent/descendant)
  sessions; branches rendered as a subtree hanging off the node they were spawned from.
- Jump: click a node -> scroll the chat transcript to that message and briefly highlight it.
  For a branch-session node, first switch the GUI to that session, then locate/highlight.
- Placement: a thin collapsible rail on the right edge of the conversation, plus a larger
  chain panel opened by clicking the rail; rail supports drag-scrub quick sliding.
- Deployment: install as a DSH npm-style plugin into the web profile and mount via
  the hot-watched user patch layer (no process restart; page refresh activates).

## DSH plugin mechanics learned (0.1.1-rc.2)

- Plugin = npm package with:
  - `dsh.bundle.patch` (e.g. `./cordis.patch.yml`) whose `- insert:` row mounts
    `{ id: chat-index, name: 'dsh-chat-index' }` as a loader entry.
  - `main` host half (`lib/index.js`) exporting a cordis plugin `{ name, apply }`
    (host entry is what makes the client module scan pick the package up).
  - `exports["./client"]` -> `lib/client.js`, a bundle registering
    `window.__ModuleLoader__.load({ id: pkgName, factory: (require) => { ... return module.exports={apply,inject,name} } })`.
  - `dsh.client = { platform: "web", inject: [<entry ids that must be active first>] }`.
- Loader: the profile boot stacks patches from `package.json["dsh"]["profile"]["bundles"]`
  in order, then `cordis.patch.yml`, then home patch. Root config `cordis.yml` is empty &
  rewritten on each boot.
- Client plugin ctx services (inject names): `slots`, `locale`, `connection`, `remote`,
  `sessions`, `theme`, `workspaces`, ... (verified provide() names).
- Client registration into seats: `ctx.slots.inject('<seat>', function* () {
  yield ctx.slots.register({ name: '<seat>', id: '<unique>', order: N }, Component)
  })`.
- Session-scope seats receive the standard kit: `sessionId`, `useSession`,
  `useSessions` (+ `useProjection`, and domain additions like `useInput`);
  root-scope seats only `useSessions`/`useWorkspaces`.
- `settings.section` (ui-settings): additive per-section settings page with label/inject.

## Seat & overlay plan (final)

- Mount seat: `conversation.session.header.utilities` (list/session, right-aligned
  session-header utilities) — session scope → free `sessionId`/`useSession`;
  root-scope `shell.overlay` was rejected because it has no per-session kit, and the
  single right-column seat `details` is product-owned (replacement only).
- All visible UI portals to `document.body` (self-hosted fixed layer, the
  dsh-better-sidebar pattern), measured from `[data-slot="conversation"]` so the
  rail hugs the conversation column and never fights header layout.
- Hot deploy: entry row goes into the profile user patch `cordis.patch.yml`
  (hot-watched by the loader); refresh the page to activate. No process restart.

## Data model (final)

- Current-session live window: `useSession(s => s.nodes)` → `kind:'user'`
  (and `'steering'`) nodes with `seq/time/content`; text = concat of
  `type:'text'` content blocks (fallback labels for image/tool blocks).
- Full durable history + branch sessions: `ctx.connection.api.sessions.history(
  { sessionId, beforeSeq, maxMessages })` pages — the same RPC the product uses
  to open session history — folding `user/message` events whose
  `data.source.kind === 'user'`.
- Descendant (branch) sessions: `useSessions` SessionListState `byId` walk over
  `parentSessionId`; per-child questions fetched with the same history RPC.
- No host HTTP endpoint needed (host half stays a minimal loader entry).

## Jump / highlight mechanics (final)

- Switch session via `ctx.sessions.open(id)` when the target is another branch;
  wait for the target window (`openState === 'open'`).
- Map seq → chat node key from `chat.nodes.values()` (kind user/steering), locate
  the row `[data-chat-anchor-key="…"]`, scroll its
  `[data-conversation-scroll]` ancestor into position, then flash the row class.
- Bounded `loadOlder` loop when the target predates the loaded window. Jump
  requests live at module level so they survive the session-scoped remount that
  switching sessions triggers.

## Fragments

- src/client fragments (lexical concat by scripts/build.mjs -> lib/client.js):
  00-libs (react/react-dom), 01-style (CSS inject), 02-utils (helpers),
  03-data (history fold / descendants / merge), 04-components (rail+panel+jump),
  05-apply (plugin def, registers into conversation.session.header.utilities).
