import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export interface ChatThread {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  cited_item_ids: string[];
  created_at: string;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ChatThread[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("chat_threads")
      .insert({ user_id: context.userId, title: "New conversation" })
      .select("id, title, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return data as ChatThread;
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error: tErr } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!thread) throw new Error("Thread not found");

    const { data: messages, error: mErr } = await context.supabase
      .from("chat_messages")
      .select("id, thread_id, role, content, cited_item_ids, created_at")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);
    return { thread: thread as ChatThread, messages: (messages ?? []) as ChatMessage[] };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Send a message and get the assistant reply. Grounded on the user's library
 * unless the user explicitly asks to search the web.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; content: string }) =>
    z
      .object({
        threadId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Persist user message
    const { error: insertErr } = await context.supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: "user",
      content: data.content,
    });
    if (insertErr) throw new Error(insertErr.message);

    // Fetch previous history
    const { data: history } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    // Retrieve context: naive relevance = latest 30 items + keyword filter
    const q = data.content.toLowerCase();
    const words = q.split(/\W+/).filter((w) => w.length > 3);
    const { data: itemRows } = await context.supabase
      .from("items")
      .select("id, title, kind, source, tags, summary_short, summary_long, transcript, raw_content")
      .order("created_at", { ascending: false })
      .limit(80);

    const scored =
      (itemRows ?? [])
        .map((it) => {
          const hay = `${it.title} ${(it.tags ?? []).join(" ")} ${it.summary_short ?? ""} ${it.summary_long ?? ""} ${(it.transcript ?? "").slice(0, 2000)} ${(it.raw_content ?? "").slice(0, 2000)}`.toLowerCase();
          const score = words.reduce((s, w) => (hay.includes(w) ? s + 1 : s), 0);
          return { it, score };
        })
        .sort((a, b) => b.score - a.score);

    const topRelevant = scored.filter((s) => s.score > 0).slice(0, 8).map((s) => s.it);
    const topRecent = (itemRows ?? []).slice(0, 6);
    const chosen = topRelevant.length ? topRelevant : topRecent;

    const libraryContext = chosen
      .map(
        (it, i) =>
          `#${i + 1} [${it.kind} • ${it.source}] "${it.title}"
Tags: ${(it.tags ?? []).join(", ") || "none"}
Summary: ${it.summary_short ?? it.summary_long?.slice(0, 400) ?? "(not analyzed yet)"}
ID: ${it.id}`,
      )
      .join("\n\n");

    const system = `You are Ember, a warm and precise AI librarian. You answer using ONLY the items in the user's saved library below, unless they explicitly ask you to search the web.
If no library item is relevant, say so gently and suggest what they could save.
When you reference items, mention their titles inline and cite their IDs at the end like: [cited: <id>, <id>].
Format your answers with markdown: headings, bullet lists, and short paragraphs.

USER'S LIBRARY (top matches):
${libraryContext || "(the library is empty)"}`;

    const messages = [
      { role: "system", content: system },
      ...((history ?? []) as Array<{ role: string; content: string }>).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (res.status === 429) throw new Error("Rate limit — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted — add credits in workspace settings.");
    if (!res.ok) throw new Error(`AI gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const assistant = json.choices?.[0]?.message?.content ?? "I'm not sure how to answer that.";

    // Extract cited ids
    const cited = Array.from(
      new Set(
        [...assistant.matchAll(/\[cited:([^\]]+)\]/gi)]
          .flatMap((m) => m[1].split(","))
          .map((s) => s.trim())
          .filter((s) => /^[0-9a-f-]{36}$/i.test(s)),
      ),
    );

    await context.supabase.from("chat_messages").insert({
      thread_id: data.threadId,
      user_id: context.userId,
      role: "assistant",
      content: assistant,
      cited_item_ids: cited,
    });

    // If thread title is still default, name it from the first message
    const first = (history ?? []).length === 0;
    if (first) {
      const title = data.content.slice(0, 60);
      await context.supabase
        .from("chat_threads")
        .update({ title, updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    } else {
      await context.supabase
        .from("chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.threadId);
    }

    return { content: assistant, cited };
  });
