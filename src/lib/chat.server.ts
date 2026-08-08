import type { SupabaseClient } from "@supabase/supabase-js";
import { indexUserItems, searchChunks } from "./embeddings.server";
import { callAI } from "./ai.server";

type AnySupabase = SupabaseClient<any, any, any>;

export async function answerLibraryQuestion(
  supabase: AnySupabase,
  userId: string,
  key: string,
  input: {
    threadId: string;
    content: string;
    collectionId?: string | null;
    itemId?: string | null;
    modelId?: string | null;
  },
) {
  const { error: insertErr } = await supabase.from("chat_messages").insert({
    thread_id: input.threadId,
    user_id: userId,
    role: "user",
    content: input.content,
  });
  if (insertErr) throw new Error(insertErr.message);

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("thread_id", input.threadId)
    .order("created_at", { ascending: true });

  // Keep the semantic index fresh for the scope we're about to search.
  let scopeItemIds: string[] | undefined;
  if (input.collectionId) {
    const { data: links } = await supabase
      .from("item_collections")
      .select("item_id")
      .eq("collection_id", input.collectionId);
    scopeItemIds = (links ?? []).map((l: any) => l.item_id as string);
  } else if (input.itemId) {
    scopeItemIds = [input.itemId];
  }
  try {
    await indexUserItems(supabase, userId, key, scopeItemIds ? { itemIds: scopeItemIds } : {});
  } catch {
    // Indexing is best-effort; fall through to whatever is already indexed.
  }

  const matches = await searchChunks(supabase, key, input.content, {
    collectionId: input.collectionId ?? null,
    itemId: input.itemId ?? null,
    limit: input.collectionId || input.itemId ? 18 : 14,
  });

  const itemIds = Array.from(new Set(matches.map((m) => m.item_id)));
  const { data: itemRows } = itemIds.length
    ? await supabase.from("items").select("id, title, kind, source, tags, summary_short").in("id", itemIds)
    : { data: [] as any[] };
  const titleOf = (id: string) => (itemRows ?? []).find((i: any) => i.id === id);

  let contextBlock = matches
    .map((m, i) => {
      const it: any = titleOf(m.item_id);
      const where = m.timestamp_label
        ? `at ${m.timestamp_label}`
        : m.section_label
          ? `section "${m.section_label}"`
          : "";
      return `#${i + 1} — "${it?.title ?? "Untitled"}" [${it?.kind ?? "item"} • ${it?.source ?? ""}] ${where}
ID: ${m.item_id}
${m.content.slice(0, 1500)}`;
    })
    .join("\n\n");

  // Fallback: if nothing is indexed yet, use item summaries in scope.
  if (!contextBlock) {
    let q = supabase
      .from("items")
      .select("id, title, kind, source, tags, summary_short, summary_long")
      .order("created_at", { ascending: false })
      .limit(20);
    if (scopeItemIds) {
      if (!scopeItemIds.length) contextBlock = "";
      else q = q.in("id", scopeItemIds);
    }
    if (!scopeItemIds || scopeItemIds.length) {
      const { data: fallback } = await q;
      contextBlock = (fallback ?? [])
        .map(
          (it: any) =>
            `"${it.title}" [${it.kind} • ${it.source}]\nID: ${it.id}\n${
              it.summary_short ?? it.summary_long?.slice(0, 400) ?? "(not analyzed yet)"
            }`,
        )
        .join("\n\n");
    }
  }

  let scopeLine = "the user's entire saved library";
  if (input.collectionId) {
    const { data: col } = await supabase
      .from("collections")
      .select("name, description")
      .eq("id", input.collectionId)
      .maybeSingle();
    scopeLine = `ONLY the collection "${(col as any)?.name ?? "this collection"}"${
      (col as any)?.description ? ` (${(col as any).description})` : ""
    }`;
  } else if (input.itemId) {
    scopeLine = "ONLY this single item";
  }

  const system = `You are Ember, a warm and precise AI librarian. You may ONLY use the SOURCE EXCERPTS below, which come from ${scopeLine}.
STRICT GROUNDING RULES:
- Never answer from general knowledge, training data, or the web. If the excerpts do not contain the answer, reply plainly that this ${input.collectionId ? "collection" : input.itemId ? "item" : "library"} doesn't cover it, and suggest what the user could save or ask instead. Do not guess or fill gaps.
- Do not invent titles, timestamps, sections or facts that are not in the excerpts.
Synthesize ACROSS the sources: compare, contrast, connect and cluster ideas instead of describing each file one by one.
Reference sources inline by title, and include the video timestamp or document section when the excerpt has one.
Format with markdown: short paragraphs, headings and bullet lists.
End every answer with a citation line listing each source you used with its exact location:
[cited: <id>@<location>, <id>@<location>]
where <location> is the video timestamp exactly as shown in the excerpt (e.g. 12:04) or the document/note section label. If an excerpt has no location, write just <id>. Never invent a location.

SOURCE EXCERPTS:
${contextBlock || "(nothing available in this scope yet)"}`;


  const messages = [
    { role: "system", content: system },
    ...((history ?? []) as Array<{ role: string; content: string }>).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const { content: assistant } = await callAI({
    messages: messages as never,
    modelId: input.modelId ?? null,
  });

  const cited = Array.from(
    new Set(
      [...assistant.matchAll(/\[cited:([^\]]+)\]/gi)]
        .flatMap((m) => (m[1] ?? "").split(","))
        .map((s) => s.trim().split("@")[0]?.trim() ?? "")
        .filter((s) => /^[0-9a-f-]{36}$/i.test(s)),
    ),
  );


  await supabase.from("chat_messages").insert({
    thread_id: input.threadId,
    user_id: userId,
    role: "assistant",
    content: assistant,
    cited_item_ids: cited,
  });

  const first = (history ?? []).length === 0;
  await supabase
    .from("chat_threads")
    .update({
      ...(first ? { title: input.content.slice(0, 60) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.threadId);

  return { content: assistant, cited };
}
