import type { SupabaseClient } from "@supabase/supabase-js";
import { searchChunks } from "./embeddings.server";

type AnySupabase = SupabaseClient<any, any, any>;

export interface SemanticHit {
  item: Record<string, any>;
  similarity: number;
  snippets: { content: string; location: string | null }[];
}

/**
 * Hybrid search: semantic (pgvector chunks) merged with keyword matches.
 * Semantic hits rank first and carry the matching snippets.
 */
export async function hybridSearch(
  supabase: AnySupabase,
  key: string,
  query: string,
  limit = 20,
): Promise<SemanticHit[]> {
  const q = query.trim();
  const byItem = new Map<string, SemanticHit>();

  let chunks: Awaited<ReturnType<typeof searchChunks>> = [];
  try {
    chunks = await searchChunks(supabase, key, q, { limit: 24 });
  } catch {
    chunks = [];
  }

  if (chunks.length) {
    const ids = Array.from(new Set(chunks.map((c) => c.item_id)));
    const { data: rows } = await supabase.from("items").select("*").in("id", ids);
    const map = new Map((rows ?? []).map((r: any) => [r.id, r]));
    for (const c of chunks) {
      const item = map.get(c.item_id);
      if (!item) continue;
      const existing = byItem.get(c.item_id);
      const snippet = {
        content: c.content.slice(0, 300),
        location: c.timestamp_label ?? c.section_label ?? null,
      };
      if (existing) {
        existing.similarity = Math.max(existing.similarity, c.similarity);
        if (existing.snippets.length < 3) existing.snippets.push(snippet);
      } else {
        byItem.set(c.item_id, { item, similarity: c.similarity, snippets: [snippet] });
      }
    }
  }

  const like = `%${q}%`;
  const { data: kw } = await supabase
    .from("items")
    .select("*")
    .or(
      `title.ilike.${like},description.ilike.${like},summary_short.ilike.${like},summary_long.ilike.${like},transcript.ilike.${like},raw_content.ilike.${like}`,
    )
    .order("created_at", { ascending: false })
    .limit(30);

  for (const r of (kw ?? []) as any[]) {
    if (!byItem.has(r.id)) byItem.set(r.id, { item: r, similarity: 0, snippets: [] });
  }

  return Array.from(byItem.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}
