import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ------------------------------ Types ------------------------------ */
export type ItemKind = "video" | "document" | "image" | "audio" | "note" | "link";
export type ItemSource = "upload" | "youtube" | "tiktok" | "instagram" | "link" | "note";
export type AnalysisStatus = "pending" | "processing" | "ready" | "failed";

export interface LibraryItem {
  id: string;
  user_id: string;
  kind: ItemKind;
  source: ItemSource;
  title: string;
  description: string | null;
  source_url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  duration_seconds: number | null;
  thumbnail_path: string | null;
  manual_thumbnail_url: string | null;
  raw_content: string | null;
  transcript: string | null;
  summary_short: string | null;
  summary_long: string | null;
  key_points: string[] | null;
  timestamps: Array<{ time: string; label: string }> | null;
  tags: string[];
  suggested_collections: string[];
  status: AnalysisStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_at: string;
}

export interface RelatedResource {
  id: string;
  item_id: string;
  kind: "url" | "item";
  target_item_id: string | null;
  url: string | null;
  title: string;
  description: string | null;
  created_at: string;
}

/* ---------------------------- List items --------------------------- */
export const listItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as LibraryItem[];
  });

/* ---------------------------- Get item ----------------------------- */
export const getItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase
      .from("items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Not found");

    let playbackUrl: string | null = null;
    if (item.storage_path) {
      const { data: signed } = await context.supabase.storage
        .from("library")
        .createSignedUrl(item.storage_path, 60 * 60 * 4);
      playbackUrl = signed?.signedUrl ?? null;
    }

    const { data: links } = await context.supabase
      .from("item_collections")
      .select("collection_id, collections(id, name)")
      .eq("item_id", data.id);

    const collections =
      (links ?? [])
        .map((l) => {
          const c = l.collections as unknown as { id: string; name: string } | null;
          return c ? { id: c.id, name: c.name } : null;
        })
        .filter((v): v is { id: string; name: string } => v !== null);

    const { data: relatedRows } = await context.supabase
      .from("related_resources")
      .select("*")
      .eq("item_id", data.id)
      .order("created_at", { ascending: true });

    const related = (relatedRows ?? []) as RelatedResource[];

    // Resolve target item titles for kind='item'
    const targetIds = related
      .filter((r) => r.kind === "item" && r.target_item_id)
      .map((r) => r.target_item_id!) as string[];
    let targets: Record<string, { id: string; title: string; kind: string }> = {};
    if (targetIds.length > 0) {
      const { data: tgt } = await context.supabase
        .from("items")
        .select("id, title, kind")
        .in("id", targetIds);
      targets = Object.fromEntries((tgt ?? []).map((t) => [t.id, t]));
    }

    return {
      item: item as LibraryItem,
      playbackUrl,
      collections,
      related,
      relatedTargets: targets,
    };
  });

/* ---------------------------- Update item -------------------------- */
export const updateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; title?: string; description?: string; manual_thumbnail_url?: string | null }) =>
      z
        .object({
          id: z.string().uuid(),
          title: z.string().min(1).max(200).optional(),
          description: z.string().max(4000).optional(),
          manual_thumbnail_url: z.string().url().nullable().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.manual_thumbnail_url !== undefined) patch.manual_thumbnail_url = data.manual_thumbnail_url;
    const { error } = await context.supabase.from("items").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- Delete item -------------------------- */
export const deleteItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: item } = await context.supabase
      .from("items")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (item?.storage_path) {
      await context.supabase.storage.from("library").remove([item.storage_path]);
    }
    const { error } = await context.supabase.from("items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Collections --------------------------- */
export const listCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("collections")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Collection[];
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; description?: string }) =>
    z
      .object({
        name: z.string().min(1).max(60),
        description: z.string().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("collections")
      .insert({
        user_id: context.userId,
        name: data.name,
        description: data.description ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as Collection;
  });

export const getCollectionWithItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: collection, error: cErr } = await context.supabase
      .from("collections")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!collection) throw new Error("Collection not found");

    const { data: links, error: lErr } = await context.supabase
      .from("item_collections")
      .select("items(*)")
      .eq("collection_id", data.id);
    if (lErr) throw new Error(lErr.message);
    const items = (links ?? [])
      .map((l) => l.items as unknown as LibraryItem | null)
      .filter((v): v is LibraryItem => v !== null);
    return { collection: collection as Collection, items };
  });

export const toggleItemInCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; collectionId: string; attach: boolean }) =>
    z
      .object({
        itemId: z.string().uuid(),
        collectionId: z.string().uuid(),
        attach: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.attach) {
      const { error } = await context.supabase.from("item_collections").upsert({
        item_id: data.itemId,
        collection_id: data.collectionId,
        user_id: context.userId,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("item_collections")
        .delete()
        .eq("item_id", data.itemId)
        .eq("collection_id", data.collectionId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* -------------------------- Related resources ---------------------- */
export const addRelatedResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      itemId: string;
      kind: "url" | "item";
      url?: string;
      targetItemId?: string;
      title: string;
      description?: string;
    }) =>
      z
        .object({
          itemId: z.string().uuid(),
          kind: z.enum(["url", "item"]),
          url: z.string().url().optional(),
          targetItemId: z.string().uuid().optional(),
          title: z.string().min(1).max(200),
          description: z.string().max(500).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.kind === "url" && !data.url) throw new Error("URL is required");
    if (data.kind === "item" && !data.targetItemId) throw new Error("Target item is required");
    const { data: row, error } = await context.supabase
      .from("related_resources")
      .insert({
        user_id: context.userId,
        item_id: data.itemId,
        kind: data.kind,
        url: data.url ?? null,
        target_item_id: data.targetItemId ?? null,
        title: data.title,
        description: data.description ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as RelatedResource;
  });

export const removeRelatedResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("related_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- Create items (link/note) ------------------- */
function detectLinkSource(url: string): { source: ItemSource; kind: ItemKind } {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return { source: "youtube", kind: "video" };
  if (u.includes("tiktok.com")) return { source: "tiktok", kind: "video" };
  // Instagram: /reel/, /reels/, /p/, /tv/ all supported as video
  if (u.includes("instagram.com")) return { source: "instagram", kind: "video" };
  return { source: "link", kind: "link" };
}

export const createItemFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; title?: string }) =>
    z
      .object({
        url: z
          .string()
          .trim()
          .url("Please enter a valid URL (must start with http:// or https://)"),
        title: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { source, kind } = detectLinkSource(data.url);
    const { fetchLinkContent } = await import("./link-fetch.server");
    const fetched = await fetchLinkContent(data.url, source);

    const title =
      data.title?.trim() || fetched.title?.trim() || guessTitleFromUrl(data.url);

    const { data: item, error } = await context.supabase
      .from("items")
      .insert({
        user_id: context.userId,
        kind,
        source,
        title,
        description: fetched.description?.slice(0, 4000) ?? null,
        raw_content: fetched.content?.slice(0, 60000) ?? null,
        transcript: fetched.transcript?.slice(0, 200000) ?? null,
        manual_thumbnail_url: fetched.thumbnailUrl ?? null,
        source_url: data.url,
        status: "pending",
        error_message: fetched.fetched ? null : fetched.note,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return item as LibraryItem;
  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; content: string }) =>
    z.object({ title: z.string().min(1).max(200), content: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase
      .from("items")
      .insert({
        user_id: context.userId,
        kind: "note",
        source: "note",
        title: data.title,
        raw_content: data.content,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return item as LibraryItem;
  });

/* ---------------------- Create item from upload -------------------- */
export const registerUploadedItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      title: string;
      storagePath: string;
      mimeType: string;
      fileSize: number;
    }) =>
      z
        .object({
          title: z.string().min(1).max(200),
          storagePath: z.string().min(1),
          mimeType: z.string().min(1),
          fileSize: z.number().int().nonnegative(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const kind: ItemKind = data.mimeType.startsWith("video/")
      ? "video"
      : data.mimeType.startsWith("audio/")
        ? "audio"
        : data.mimeType.startsWith("image/")
          ? "image"
          : "document";

    const { data: item, error } = await context.supabase
      .from("items")
      .insert({
        user_id: context.userId,
        kind,
        source: "upload",
        title: data.title,
        storage_path: data.storagePath,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return item as LibraryItem;
  });

/* ------------------------------ AI --------------------------------- */
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_INLINE_BYTES = 20 * 1024 * 1024;

interface AnalysisResult {
  title?: string;
  summary_short: string;
  summary_long: string;
  key_points: string[];
  tags: string[];
  suggested_collections: string[];
  transcript?: string | null;
  timestamps?: Array<{ time: string; label: string }>;
}

function buildSystemPrompt(): string {
  return `You are Ember, an AI librarian analyzing a user's saved knowledge item.
You are meticulous, warm, and precise. Read/watch/listen to the material provided and return a JSON object.

GROUNDING RULES (absolute):
- Use ONLY the material given to you: attached media, transcript, extracted text, and the user's own description.
- NEVER infer or invent content from a URL, a filename, a channel name, or general knowledge. If the actual content was not provided, say so.
- If the provided material is too thin to summarise, set summary_short and summary_long to a short honest statement such as "The content of this item could not be retrieved, so it hasn't been analysed yet." and return empty key_points.
- Never fabricate a transcript. Only return a transcript you produced from provided audio/video, or the transcript supplied to you.

Return ONLY valid JSON matching this shape:
{
  "title": string (optional — a better, concise title, only if grounded in the actual content),
  "summary_short": string (a real 3-5 sentence paragraph — cover what the content is about, the main argument or purpose, and the standout insight. Do NOT write a one-line teaser.),
  "summary_long": string (3-6 paragraphs, plain text with \\n\\n between them, covering context, main ideas, evidence or examples, and takeaways),
  "key_points": string[] (3-8 actionable takeaways, each a complete sentence),
  "tags": string[] (5-12 lowercase, hyphen-free searchable keywords),
  "suggested_collections": string[] (1-4 short collection names in Title Case, e.g. "Recipes", "Leadership", "Psychology"),
  "transcript": string | null (only for videos/audio you actually received; otherwise null),
  "timestamps": [{"time": "MM:SS", "label": string}] (only when grounded in real timings; otherwise omit)
}`;
}

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_INLINE_BYTES) return null;
  const mime = res.headers.get("content-type") ?? "application/octet-stream";
  const b64 = Buffer.from(buf).toString("base64");
  return { data: b64, mime };
}

function extractJson(text: string): AnalysisResult | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as AnalysisResult;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as AnalysisResult;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackSummary(item: { title: string; raw_content: string | null; description: string | null; source: string }): string {
  const source = item.raw_content ?? item.description ?? "";
  if (source) {
    const trimmed = source.replace(/\s+/g, " ").trim().slice(0, 400);
    return trimmed + (source.length > 400 ? "…" : "");
  }
  return `Summary unavailable. This ${item.source} item was saved as "${item.title}" but hasn't been analyzed yet — try Re-analyze.`;
}

export const analyzeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { data: item, error } = await context.supabase
      .from("items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Item not found");

    await context.supabase
      .from("items")
      .update({ status: "processing", error_message: null })
      .eq("id", data.id);

    try {
      const parts: Array<Record<string, unknown>> = [];
      let instruction = `Analyze this item titled "${item.title}".`;
      let hasMaterial = false;
      let fetchNote: string | null = null;

      // Link items: (re)fetch real content so the model never guesses from a URL.
      let description = item.description as string | null;
      let rawContent = item.raw_content as string | null;
      let transcript = item.transcript as string | null;
      if (item.source_url && !rawContent && !transcript) {
        const { fetchLinkContent } = await import("./link-fetch.server");
        const fetched = await fetchLinkContent(item.source_url, item.source);
        description = description ?? fetched.description;
        rawContent = fetched.content;
        transcript = fetched.transcript;
        fetchNote = fetched.note;
        const linkPatch: Record<string, unknown> = {};
        if (rawContent) linkPatch.raw_content = rawContent.slice(0, 60000);
        if (transcript) linkPatch.transcript = transcript.slice(0, 200000);
        if (description && !item.description) linkPatch.description = description.slice(0, 4000);
        if (fetched.thumbnailUrl && !item.manual_thumbnail_url)
          linkPatch.manual_thumbnail_url = fetched.thumbnailUrl;
        if (Object.keys(linkPatch).length > 0) {
          await context.supabase.from("items").update(linkPatch as never).eq("id", data.id);
        }
      }

      if (description) {
        instruction += `\n\nDescription from the source:\n${description}`;
        hasMaterial = true;
      }
      if (transcript) {
        instruction += `\n\nTranscript (verbatim, timestamped):\n${transcript.slice(0, 60000)}`;
        hasMaterial = true;
      }
      if (rawContent && rawContent !== transcript) {
        instruction += `\n\nExtracted content:\n${rawContent.slice(0, 40000)}`;
        hasMaterial = true;
      }
      if (item.source_url) {
        instruction += `\n\nSource URL (reference only — do NOT infer content from it): ${item.source_url}`;
      }
      if (item.source_url && !transcript) {
        instruction += `\n\nNo transcript is available for this item.${fetchNote ? ` (${fetchNote})` : ""}`;
      }

      if (item.storage_path && item.mime_type) {
        const { data: signed } = await context.supabase.storage
          .from("library")
          .createSignedUrl(item.storage_path, 60 * 10);
        if (signed?.signedUrl) {
          const blob = await fetchAsBase64(signed.signedUrl);
          if (blob) {
            hasMaterial = true;
            if (item.mime_type.startsWith("image/")) {
              parts.push({ type: "image_url", image_url: { url: `data:${blob.mime};base64,${blob.data}` } });
            } else if (item.mime_type.startsWith("audio/")) {
              const fmt = item.mime_type.split("/")[1]?.split(";")[0] || "webm";
              parts.push({ type: "input_audio", input_audio: { data: blob.data, format: fmt } });
            } else {
              // PDFs, office documents and video all travel as inline file parts.
              parts.push({
                type: "file",
                file: {
                  filename: item.title,
                  file_data: `data:${item.mime_type};base64,${blob.data}`,
                },
              });
            }
          } else {
            fetchNote = `The file is larger than ${Math.round(MAX_INLINE_BYTES / (1024 * 1024))} MB, so it could not be analysed.`;
          }
        }
      }

      if (!hasMaterial) {
        const note =
          fetchNote ??
          "The content of this item could not be retrieved, so it hasn't been analysed.";
        await context.supabase
          .from("items")
          .update({
            status: "failed",
            error_message: note,
            summary_short: note + " Add a title and description manually, or re-analyse.",
            summary_long: note,
            transcript: transcript ?? null,
          } as never)
          .eq("id", data.id);
        throw new Error(note);
      }

      parts.unshift({ type: "text", text: instruction });

      const body = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: parts },
        ],
        response_format: { type: "json_object" as const },
      };

      const res = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`AI gateway ${res.status}: ${errText.slice(0, 400)}`);
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "";
      const analysis = extractJson(content);
      if (!analysis) throw new Error("AI returned unparseable response");

      const summaryShort =
        (analysis.summary_short && analysis.summary_short.trim()) || fallbackSummary(item);
      const summaryLong = analysis.summary_long?.trim() || summaryShort;

      const patch: Record<string, unknown> = {
        status: "ready",
        summary_short: summaryShort.slice(0, 2000),
        summary_long: summaryLong,
        key_points: Array.isArray(analysis.key_points) ? analysis.key_points.slice(0, 12) : [],
        tags: Array.isArray(analysis.tags)
          ? analysis.tags.map((t) => String(t).toLowerCase()).slice(0, 20)
          : [],
        suggested_collections: Array.isArray(analysis.suggested_collections)
          ? analysis.suggested_collections.slice(0, 6)
          : [],
        // Never overwrite a real fetched transcript with a model-generated one.
        transcript: transcript ?? analysis.transcript ?? null,
        timestamps: Array.isArray(analysis.timestamps) ? analysis.timestamps.slice(0, 30) : [],
        error_message: null,
      };
      // Adopt a better title unless the user typed one themselves.
      const autoDerived =
        /^https?:/i.test(item.title) ||
        /\.[a-z0-9]{2,4}$/i.test(item.title) ||
        item.title.trim().length < 6 ||
        (item.source_url !== null && item.title === guessTitleFromUrl(item.source_url));
      if (analysis.title && analysis.title.trim().length > 3 && autoDerived) {
        patch.title = analysis.title.trim().slice(0, 200);
      }

      const { error: uErr } = await context.supabase.from("items").update(patch as never).eq("id", data.id);
      if (uErr) throw new Error(uErr.message);

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      // Still populate a fallback summary so the UI is never empty.
      await context.supabase
        .from("items")
        .update({
          status: "failed",
          error_message: message.slice(0, 500),
          summary_short: item.summary_short ?? fallbackSummary(item),
        })
        .eq("id", data.id);
      throw err;
    }
  });

/* ------------------------ Natural language search ------------------ */
export const searchLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) =>
    z.object({ query: z.string().min(1).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const q = data.query.trim();
    const like = `%${q}%`;
    const { data: rows, error } = await context.supabase
      .from("items")
      .select("*")
      .or(
        `title.ilike.${like},description.ilike.${like},summary_short.ilike.${like},summary_long.ilike.${like},transcript.ilike.${like},raw_content.ilike.${like}`,
      )
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);

    const { data: tagged } = await context.supabase
      .from("items")
      .select("*")
      .contains("tags", [q.toLowerCase()])
      .limit(20);

    const merged = new Map<string, LibraryItem>();
    (rows ?? []).forEach((r) => merged.set(r.id, r as LibraryItem));
    (tagged ?? []).forEach((r) => merged.set(r.id, r as LibraryItem));
    return Array.from(merged.values());
  });

/* --------------------------- helpers ------------------------------- */
function guessTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("instagram.com")) {
      if (u.pathname.includes("/reel/") || u.pathname.includes("/reels/")) return "Instagram Reel";
      if (u.pathname.includes("/p/")) return "Instagram post";
      if (u.pathname.includes("/tv/")) return "Instagram IGTV";
      return "Instagram";
    }
    if (u.hostname.includes("tiktok.com")) return "TikTok video";
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) return "YouTube video";
    return `${u.hostname.replace(/^www\./, "")} — ${u.pathname.slice(1, 60) || "link"}`;
  } catch {
    return url.slice(0, 60);
  }
}
