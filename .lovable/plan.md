# Collection AI assistants + smart auto-organization

Two connected features: a chat assistant scoped to each collection, and AI that groups library items into collections on its own. Both run on top of a new semantic index (embeddings) stored in the existing backend.

## 1. Semantic index (foundation)

- Enable pgvector and add an `item_chunks` table: item id, chunk text, chunk order, optional timestamp/section label, embedding vector, plus a `content_hash` on each item.
- Text for each item comes from what already exists: transcript, raw content, note body, summaries, key points.
- Videos are chunked by transcript segment so a chunk can carry a timestamp; documents/notes are chunked by paragraph with a section label.
- Embedding runs only for items whose content hash changed or that have no chunks yet — nothing is reprocessed otherwise. A "force full re-index" option exists but is never the default.
- Embeddings via the platform AI embedding model; search via cosine similarity with an HNSW index.

## 2. Collection AI assistant

- Opening a collection shows a chat panel next to the item grid — no file picking required, the collection scope is automatic.
- Answering a question: embed the question, retrieve top chunks **restricted to items in that collection**, and send them to the AI with instructions to synthesize across items rather than answer per file.
- Every answer cites sources: item title, plus timestamp for videos and section for documents. Citations render as clickable chips that open the item (and jump to the timestamp where available).
- Handles cross-item questions like "summarize everything about X", "which videos contradict this document", "what concepts appear most often", "create study notes from this collection".
- Threads are per collection and saved, matching how existing chat history works. Single-item chat stays available from the item detail page.

## 3. AI auto-organization

- **Auto Organize** button on the library page. It embeds only new/changed items, clusters them semantically, and proposes a plan.
- The plan is shown as a review sheet before anything changes: items to add to existing collections, brand-new collections to create (with AI-generated name, description, icon and color), and any suggested merges or splits. The user can approve all, approve individual rows, or dismiss.
- New uploads get an automatic suggestion of the best-fitting collection; if nothing fits well, a new collection is proposed.
- One item can land in several collections — that's expected, not a conflict.
- Safety rules: user-created collections are never deleted, manually placed items are never silently removed (any such change appears in the review list with an undo), and AI-created collections can be renamed, merged, split, or turned off.
- A per-collection "AI managed" flag lets a user freeze a collection so auto-organize leaves it alone.

## Technical notes

- Migration: `create extension vector`, `item_chunks` table with `vector` column + HNSW index, `content_hash` and `embedded_at` on `items`, `ai_managed`/`cover_image_url` on `collections`, an `organize_runs` table for last-run tracking, and a `match_item_chunks` SQL function filtered by collection. All new tables get grants + RLS scoped to the owner.
- New server functions in `src/lib/embeddings.functions.ts` (index items, similarity search) and `src/lib/organize.functions.ts` (propose plan, apply plan). Collection chat extends `src/lib/chat.functions.ts` with a `collection_id` on threads.
- UI: chat panel + citation chips on `src/routes/_authenticated/collection.$id.tsx`, Auto Organize button and review sheet on `src/routes/_authenticated/library.tsx`.
- All new user-facing strings added to both English and Romanian translation files.

## Scope note

Cover images for collections will use an AI-picked gradient/icon pairing rather than generated artwork, unless you'd like generated images (slower and costs more per collection).
