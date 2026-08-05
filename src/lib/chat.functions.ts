import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface ChatThread {
  id: string;
  title: string;
  updated_at: string;
  created_at: string;
  collection_id?: string | null;
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
  .inputValidator((input: { collectionId?: string | null } | undefined) =>
    z.object({ collectionId: z.string().uuid().nullish() }).default({}).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at, collection_id")
      .order("updated_at", { ascending: false });
    q = data.collectionId ? q.eq("collection_id", data.collectionId) : q.is("collection_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as ChatThread[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { collectionId?: string | null } | undefined) =>
    z.object({ collectionId: z.string().uuid().nullish() }).default({}).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_threads")
      .insert({
        user_id: context.userId,
        title: "New conversation",
        collection_id: data.collectionId ?? null,
      })
      .select("id, title, updated_at, created_at, collection_id")
      .single();
    if (error) throw new Error(error.message);
    return row as ChatThread;
  });

export const getThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: thread, error: tErr } = await context.supabase
      .from("chat_threads")
      .select("id, title, updated_at, created_at, collection_id")
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
 * Send a message and get the assistant reply, grounded on the user's library
 * (optionally scoped to a single collection or item) via semantic retrieval.
 */
export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId: string; content: string; collectionId?: string | null; itemId?: string | null }) =>
    z
      .object({
        threadId: z.string().uuid(),
        content: z.string().min(1).max(4000),
        collectionId: z.string().uuid().nullish(),
        itemId: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { answerLibraryQuestion } = await import("./chat.server");
    return answerLibraryQuestion(context.supabase as never, context.userId, key, data);
  });
