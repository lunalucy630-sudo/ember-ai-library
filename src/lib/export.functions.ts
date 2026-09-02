import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Full-library export. Returns everything the user owns as plain JSON plus
 * short-lived download links for each stored file so the client can bundle
 * a portable ZIP. No AI is involved — this is pure data portability.
 */
export interface ExportFile {
  itemId: string;
  storagePath: string;
  fileName: string;
  url: string;
}

export const exportLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [items, collections, links, related, threads, messages, profile] = await Promise.all([
      supabase.from("items").select("*").order("created_at"),
      supabase.from("collections").select("*").order("created_at"),
      supabase.from("item_collections").select("item_id, collection_id, created_at"),
      supabase.from("related_resources").select("*"),
      supabase.from("chat_threads").select("*"),
      supabase.from("chat_messages").select("*").order("created_at"),
      supabase.from("profiles").select("display_name, ai_mode, ai_auto_analyze").eq("id", userId).maybeSingle(),
    ]);

    for (const r of [items, collections, links, related, threads, messages]) {
      if (r.error) throw new Error(r.error.message);
    }

    // Signed URLs for every stored file (valid 1h — enough for the client to zip them).
    const files: ExportFile[] = [];
    const withFiles = (items.data ?? []).filter((i) => i.storage_path);
    if (withFiles.length > 0) {
      const { data: signed } = await supabase.storage
        .from("library")
        .createSignedUrls(
          withFiles.map((i) => i.storage_path as string),
          60 * 60,
        );
      (signed ?? []).forEach((s, idx) => {
        const it = withFiles[idx];
        if (!s.signedUrl || !it) return;
        const ext = (it.storage_path as string).split(".").pop() ?? "bin";
        const safe = it.title.replace(/[^\w\-\u00C0-\u024F ]+/g, "").trim().slice(0, 60) || "item";
        files.push({
          itemId: it.id,
          storagePath: it.storage_path as string,
          fileName: `${safe}-${it.id.slice(0, 8)}.${ext}`,
          url: s.signedUrl,
        });
      });
    }

    const strip = <T extends Record<string, unknown>>(rows: T[] | null) =>
      (rows ?? []).map(({ user_id: _u, ...rest }) => rest);

    return {
      format: "ember-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: profile.data ?? null,
      items: strip(items.data as Record<string, unknown>[] | null),
      collections: strip(collections.data as Record<string, unknown>[] | null),
      itemCollections: links.data ?? [],
      relatedResources: strip(related.data as Record<string, unknown>[] | null),
      chatThreads: strip(threads.data as Record<string, unknown>[] | null),
      chatMessages: strip(messages.data as Record<string, unknown>[] | null),
      files,
    };
  });
