# Ember: Library-First, AI-Optional Migration

## What already exists (inspected, keep it)

- Routes: `/library`, `/upload`, `/search`, `/collection/$id`, `/item/$id`, `/chat`, `/auth`, all under an auth gate.
- Database: `items`, `collections`, `item_collections`, `item_chunks` (pgvector 3072d), `chat_threads`, `chat_messages`, `related_resources`, `organize_runs`, `profiles`. RLS is per-user on all of them.
- AI: provider-agnostic `callAI` layer with model catalog + fallback, embeddings/indexing, scoped RAG chat with citations, auto-organize clustering.
- Import: real link fetching (YouTube/TikTok/OG), file upload to private `library` bucket, per-item re-analyse with visible errors.
- Design: ivory/blush theme system with 9 presets, light/dark, EN + RO i18n.

Nothing here gets rebuilt. The gaps versus the new spec are: AI is always-on, search leans on embeddings, there is no workspace boundary, no job/progress model, no research/write surfaces, and no Fae's Workshop.

## Security check (Phase 2, first)

- `.env` holds only publishable/anon keys — safe, but it is not gitignored; add it.
- Service-role key is used only in a server-only module — correct, no client exposure.
- Existing RLS is sound; new tables will follow the same `auth.uid()` pattern with explicit GRANTs.

## Phased plan

I will do one phase per round, not all at once.

**Phase 2 — Workspaces & permissions**
Add `workspaces` + `workspace_members`, give every item/collection a `workspace_id`, backfill each user's existing content into their personal "Ember" workspace. RLS rewritten to membership-based checks so a workspace can be isolated at the database level. Add `ai_enabled` and `ai_allowed` flags on workspace.

**Phase 3 — Library works with zero AI**
- Per-user AI settings: Off / Ask before using AI / Only when I ask / Auto-analyze new items. Stored in the database, respected by upload and every server function.
- Upload/import path split from analysis; nothing calls a model unless settings allow it.
- Manual metadata: title, description, tags, notes, collections, all editable without AI.

**Phase 4 — Real search without AI**
Postgres full-text search (`tsvector` column + GIN index) over title, description, tags, transcript, OCR text, notes, collection names. `/search` becomes keyword-first, with semantic results merged in only when AI is enabled. Filters for kind, collection, tag, date, status; sort options.

**Phase 5 — Processing jobs**
`processing_jobs` + `processing_events` with explicit stages (queued → uploaded → extracting → transcribing → analyzing → indexing → ready/failed). Per-stage failure does not kill the item. UI shows the checklist progress on the item card and item page.

**Phase 6 — Ask / Research / Write**
Three distinct surfaces instead of one chatbot. Ask = current grounded RAG chat, kept. Research = `research_projects` / `research_sources` / `research_findings` with scope selection (library, library+web, academic) and "Save to Library". Write = source-grounded drafting from selected sources.

**Phase 7-8 — Capability-based model registry & orchestration**
Replace the flat model list with a registry carrying capabilities (research, web_search, long_context, multimodal, writing, reasoning, structured_output) and an availability state (free / paid / api_key_required / connected_account_required / unavailable). A router picks models per task; a plan panel shows which models, why, and lets the user approve, with a "max models per task" setting and a transparency report (library sources, web sources, models, citations).

**Phase 9 — Knowledge moments, relations, smart collections**
`knowledge_moments` (saveable timestamped excerpts), typed `related_resources` (related to / expands on / contradicts / derived from), rule-based smart collections. `personal_memories` kept strictly separate from source knowledge.

**Phase 10 — Fae's Workshop**
A separate workspace with `ai_allowed = false` enforced in the database, its own navigation and visual identity, and sections for Story Vault, Characters, Episodes, Canvas Archive (with version chains), Idea Garden, Experiments (canon/possible/experimental/discarded status). Excluded from all Ember search, AI context, and research by workspace scoping — not by hiding routes.

**Phase 11 — Polish**

## Technical notes

Everything stays TanStack Start server functions (no edge functions), typed against generated Supabase types. Each schema change is one migration with GRANTs and RLS. Existing components (`AppShell`, item cards, `ScopedChatPanel`, theme system) are extended, not replaced.

## Starting point

If you approve, I begin with Phase 2 + 3 together — the workspace boundary and the AI on/off controls — since Fae's Workshop and "library without AI" both depend on them.
