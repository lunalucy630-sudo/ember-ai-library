import type { SupabaseClient } from "@supabase/supabase-js";

const EMBEDDINGS_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const EMBEDDING_MODEL = "google/gemini-embedding-001";
const BATCH = 50;

type AnySupabase = SupabaseClient<any, any, any>;

export interface Chunk {
  content: string;
  timestamp_label: string | null;
  section_label: string | null;
}

export async function hashContent(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Text that represents an item for semantic search. */
export function itemSourceText(item: Record<string, any>): string {
  const keyPoints = Array.isArray(item.key_points)
    ? (item.key_points as unknown[]).map((k) => (typeof k === "string" ? k : JSON.stringify(k))).join("\n")
    : "";
  return [
    `Title: ${item.title ?? ""}`,
    item.description ? `Description: ${item.description}` : "",
    item.summary_short ? `Summary: ${item.summary_short}` : "",
    item.summary_long ?? "",
    keyPoints ? `Key points:\n${keyPoints}` : "",
    (item.tags ?? []).length ? `Tags: ${(item.tags ?? []).join(", ")}` : "",
    item.transcript ?? "",
    item.raw_content ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const TS_RE = /(?:^|\s)\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?/;

/** Chunk an item: transcript segments keep timestamps, prose keeps section labels. */
export function buildChunks(item: Record<string, any>): Chunk[] {
  const chunks: Chunk[] = [];
  const push = (content: string, timestamp: string | null, section: string | null) => {
    const trimmed = content.trim();
    if (trimmed.length < 20) return;
    chunks.push({ content: trimmed.slice(0, 4000), timestamp_label: timestamp, section_label: section });
  };

  // Header chunk: always present so even thin items are searchable.
  push(
    [
      `Title: ${item.title ?? ""}`,
      item.summary_short ? `Summary: ${item.summary_short}` : "",
      (item.tags ?? []).length ? `Tags: ${(item.tags ?? []).join(", ")}` : "",
      item.summary_long ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
    null,
    "Overview",
  );

  const transcript: string = item.transcript ?? "";
  if (transcript.trim()) {
    const lines = transcript.split(/\r?\n+/).filter((l) => l.trim());
    let buf: string[] = [];
    let ts: string | null = null;
    const flush = () => {
      if (buf.length) push(buf.join("\n"), ts, "Transcript");
      buf = [];
      ts = null;
    };
    for (const line of lines) {
      const m = line.match(TS_RE);
      if (m && buf.length >= 4) flush();
      if (m && !ts) ts = m[1] ?? null;
      buf.push(line);
      if (buf.join("\n").length > 1400) flush();
    }
    flush();
  }

  const prose: string = item.raw_content ?? "";
  if (prose.trim()) {
    const paras = prose.split(/\n\s*\n/).filter((p) => p.trim());
    let buf: string[] = [];
    let section: string | null = null;
    const flush = () => {
      if (buf.length) push(buf.join("\n\n"), null, section ?? "Content");
      buf = [];
    };
    for (const p of paras) {
      const line = p.trim();
      const isHeading = line.length < 90 && (/^#{1,4}\s/.test(line) || /^[A-Z0-9][^.!?]{3,80}$/.test(line));
      if (isHeading) {
        flush();
        section = line.replace(/^#{1,4}\s*/, "");
        continue;
      }
      buf.push(line);
      if (buf.join("\n\n").length > 1400) flush();
    }
    flush();
  }

  return chunks.slice(0, 120);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serializes gateway calls and keeps a minimum gap between them. */
let embedQueue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
const MIN_GAP_MS = 500;
const MAX_ATTEMPTS = 6;

async function embedBatch(batch: string[], key: string): Promise<number[][]> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const gap = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (gap > 0) await sleep(gap);
    lastCallAt = Date.now();

    const res = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });

    if (res.status === 429 || res.status >= 500) {
      const detail = (await res.text()).slice(0, 200);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          res.status === 429
            ? "Ember is still being rate limited by the AI service. Indexing saved what it could — press Auto Organize again in a minute to continue."
            : `Embedding upstream error ${res.status}. ${detail}`,
        );
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(20000, 1500 * 2 ** (attempt - 1)) + Math.random() * 500;
      await sleep(wait);
      continue;
    }

    if (res.status === 402) throw new Error("AI credits exhausted — add credits to continue.");
    if (!res.ok) throw new Error(`Embedding failed (${res.status}): ${(await res.text()).slice(0, 200)}`);

    const json = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
    return (json.data ?? [])
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
  throw new Error("Embedding failed unexpectedly.");
}

export async function embedTexts(texts: string[], key: string): Promise<number[][]> {
  // Chain onto the shared queue so concurrent callers never burst the gateway.
  const run = embedQueue.then(async () => {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH).map((t) => t.slice(0, 6000));
      out.push(...(await embedBatch(batch, key)));
    }
    return out;
  });
  embedQueue = run.catch(() => {});
  return run;
}

export interface IndexResult {
  indexed: number;
  skipped: number;
  chunks: number;
  /** Items still awaiting embedding after this pass. */
  remaining: number;
  /** Items that needed embedding when this pass started. */
  pending: number;
}

/** Embed only items that are new or whose content changed. */
export async function indexUserItems(
  supabase: AnySupabase,
  userId: string,
  key: string,
  opts: { force?: boolean; itemIds?: string[]; maxItems?: number } = {},
): Promise<IndexResult> {
  let query = supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (opts.itemIds?.length) query = query.in("id", opts.itemIds);
  const { data: items, error } = await query;
  if (error) throw new Error(error.message);

  let skipped = 0;

  // Decide up front what actually needs work, so we can report progress.
  const work: Array<{ item: Record<string, any>; hash: string; chunks: Chunk[] }> = [];
  for (const item of items ?? []) {
    const source = itemSourceText(item);
    if (source.trim().length < 30) {
      skipped++;
      continue;
    }
    const hash = await hashContent(source);
    if (!opts.force && item.content_hash === hash && item.embedded_at) {
      skipped++;
      continue;
    }
    const chunks = buildChunks(item);
    if (!chunks.length) {
      skipped++;
      continue;
    }
    work.push({ item, hash, chunks });
  }

  const pending = work.length;
  const slice = opts.maxItems ? work.slice(0, opts.maxItems) : work;

  // Embed across items in one shared request stream instead of one call per item.
  const allTexts = slice.flatMap((w) => w.chunks.map((c) => c.content));
  const vectors = allTexts.length ? await embedTexts(allTexts, key) : [];

  let indexed = 0;
  let chunkCount = 0;
  let cursor = 0;

  for (const { item, hash, chunks } of slice) {
    const vecs = vectors.slice(cursor, cursor + chunks.length);
    cursor += chunks.length;

    await supabase.from("item_chunks").delete().eq("item_id", item.id);
    const rows = chunks.map((c, i) => ({
      user_id: userId,
      item_id: item.id,
      chunk_index: i,
      content: c.content,
      timestamp_label: c.timestamp_label,
      section_label: c.section_label,
      embedding: JSON.stringify(vecs[i] ?? []),
    }));
    const { error: insErr } = await supabase.from("item_chunks").insert(rows as never);
    if (insErr) throw new Error(insErr.message);

    await supabase
      .from("items")
      .update({ content_hash: hash, embedded_at: new Date().toISOString() })
      .eq("id", item.id);

    indexed++;
    chunkCount += rows.length;
  }

  return { indexed, skipped, chunks: chunkCount, pending, remaining: pending - indexed };
}

export interface MatchedChunk {
  id: string;
  item_id: string;
  content: string;
  timestamp_label: string | null;
  section_label: string | null;
  similarity: number;
}

export async function searchChunks(
  supabase: AnySupabase,
  key: string,
  query: string,
  opts: { collectionId?: string | null; itemId?: string | null; limit?: number } = {},
): Promise<MatchedChunk[]> {
  const [vec] = await embedTexts([query], key);
  if (!vec) return [];
  const { data, error } = await supabase.rpc("match_item_chunks", {
    query_embedding: JSON.stringify(vec),
    match_count: opts.limit ?? 14,
    filter_collection_id: opts.collectionId ?? null,
    filter_item_id: opts.itemId ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchedChunk[];
}
