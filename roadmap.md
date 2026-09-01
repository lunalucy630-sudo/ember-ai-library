# Ember roadmap

## Phase 2 — Workspaces & permissions (in progress)
- [x] `workspaces` + `workspace_members` tables, membership helper, RLS
- [x] `workspace_id` on items/collections
- [x] AI preferences on profiles (`ai_mode`, `ai_auto_analyze`)
- [ ] Lock down SECURITY DEFINER execute grants
- [ ] Bootstrap default workspace per user + backfill existing content
- [ ] Workspace switcher in the app shell

## Phase 3 — Library works without AI
- [ ] AI settings UI (off / ask / manual / auto)
- [ ] Upload & import never call a model unless settings allow
- [ ] Manual metadata editing (title, description, tags, notes, collections)

## Phase 4 — Keyword-first search (Postgres FTS)
## Phase 5 — Processing jobs & visible progress
## Phase 6 — Ask / Research / Write surfaces
## Phase 7-8 — Capability model registry + multi-model orchestration
## Phase 9 — Knowledge moments, typed relations, smart collections, personal memories
## Phase 10 — Fae's Workshop (private, AI-free workspace)
- [ ] Workshop workspace kind with `ai_allowed = false` enforced in DB
- [ ] Sections: Story Vault, Characters, Episodes, Canvas Archive (versions), Idea Garden, Experiments
- [ ] Workshop-only search (no AI), own visual identity
- [ ] **One-time invitation system**: `workspace_invitations` with hashed token, expiry (7d default), single use, revocable; owner generates from Settings → Fae's Workshop
- [ ] `/invite/fae/<token>` acceptance flow — Fae signs in with her own identity, token consumed on accept
- [ ] Fae sees only the Workshop (never owner's library, AI, research, memories); owner keeps admin control but is not a visible member
- [ ] "Leave Workshop" revokes access without deleting content

## Phase 11 — Polish

## Design system (folded into Phase 11, tokens landed early)
- [ ] Tinted dark mode: layered warm surfaces (background / surface / elevated / card / hover / active), no pure black, no neon or heavy glow
- [ ] Semantic tokens: surface-*, border-subtle, text-primary/secondary/muted, accent-hover/soft, success/warning/error — light + dark values in src/styles.css
- [ ] Components reference tokens only (no hex, no bg-black/text-white)
- [ ] Workshop identity: deep plum / muted violet / dusky wine / warm parchment, tinted dark, artwork stays the focus
- [ ] Audit both themes: inputs, dialogs, dropdowns, nav, hover/selected, empty + loading states, media previews
