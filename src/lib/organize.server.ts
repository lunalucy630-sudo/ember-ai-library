import type { SupabaseClient } from "@supabase/supabase-js";
import { indexUserItems } from "./embeddings.server";
import { callAI } from "./ai.server";

type AnySupabase = SupabaseClient<any, any, any>;

export type OrganizeAction =
  | {
      type: "add";
      itemId: string;
      itemTitle: string;
      collectionId: string;
      collectionName: string;
      reason: string;
    }
  | {
      type: "create";
      name: string;
      description: string;
      icon: string;
      gradient: string;
      itemIds: string[];
      itemTitles: string[];
      reason: string;
    }
  | {
      type: "merge";
      fromCollectionId: string;
      fromName: string;
      intoCollectionId: string;
      intoName: string;
      reason: string;
    };

export interface OrganizePlan {
  runId: string;
  actions: OrganizeAction[];
  itemsProcessed: number;
  indexed: number;
}

const GRADIENTS = [
  "from-coral to-rose",
  "from-rose to-blush",
  "from-amber-400 to-rose-400",
  "from-sky-400 to-indigo-400",
  "from-emerald-400 to-teal-400",
  "from-violet-400 to-fuchsia-400",
  "from-slate-400 to-slate-600",
];

export async function proposeOrganizePlan(
  supabase: AnySupabase,
  userId: string,
  key: string,
  opts: { force?: boolean } = {},
): Promise<OrganizePlan> {
  const { indexed } = await indexUserItems(supabase, userId, key, { force: opts.force });

  const [{ data: items }, { data: collections }, { data: links }, { data: lastRun }] = await Promise.all([
    supabase
      .from("items")
      .select("id, title, kind, source, tags, summary_short, updated_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("collections").select("id, name, description, ai_managed"),
    supabase.from("item_collections").select("item_id, collection_id"),
    supabase
      .from("organize_runs")
      .select("created_at")
      .eq("status", "applied")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const allItems = items ?? [];
  const cols = collections ?? [];
  const memberships = links ?? [];
  const lastAt = lastRun?.created_at ? new Date(lastRun.created_at as string).getTime() : 0;

  const candidates = opts.force
    ? allItems
    : allItems.filter((it: any) => {
        const changed = new Date(it.updated_at).getTime() > lastAt;
        const uncategorized = !memberships.some((m: any) => m.item_id === it.id);
        return changed || uncategorized;
      });

  if (!candidates.length) {
    const { data: run } = await supabase
      .from("organize_runs")
      .insert({ user_id: userId, plan: [], items_processed: 0, status: "proposed" })
      .select("id")
      .single();
    return { runId: (run as any)?.id ?? "", actions: [], itemsProcessed: 0, indexed };
  }

  const itemLines = candidates
    .map(
      (it: any) =>
        `- id:${it.id} | ${it.kind}/${it.source} | "${it.title}" | tags: ${(it.tags ?? []).join(", ") || "none"} | ${
          (it.summary_short ?? "no summary").slice(0, 220)
        } | currently in: ${
          memberships
            .filter((m: any) => m.item_id === it.id)
            .map((m: any) => cols.find((c: any) => c.id === m.collection_id)?.name)
            .filter(Boolean)
            .join(", ") || "nothing"
        }`,
    )
    .join("\n");

  const colLines = cols.length
    ? cols
        .map(
          (c: any) =>
            `- id:${c.id} | "${c.name}" | ${c.description ?? "no description"} | ${
              c.ai_managed ? "ai-managed" : "user-created (never delete, never remove items)"
            }`,
        )
        .join("\n")
    : "(no collections yet)";

  const system = `You are Ember's librarian. You organize a personal knowledge library into meaningful, semantic collections.
Rules:
- Group by actual subject matter, never by file type or date.
- An item may belong to several collections when genuinely relevant (max 3).
- Prefer an existing collection when it fits; only create a new one when nothing fits.
- Never delete or empty user-created collections. Never remove an item from a collection.
- New collections need a human, specific name (2-3 words), a one-sentence description, and a lucide icon name.
- Suggest a merge only when two collections clearly cover the same topic.
Return STRICT JSON only:
{"actions":[
 {"type":"add","itemId":"<uuid>","collectionId":"<uuid>","reason":"..."},
 {"type":"create","name":"...","description":"...","icon":"BookOpen","itemIds":["<uuid>"],"reason":"..."},
 {"type":"merge","fromCollectionId":"<uuid>","intoCollectionId":"<uuid>","reason":"..."}
]}`;

  const { content: raw } = await callAI({
    modelId,
    jsonMode: true,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `EXISTING COLLECTIONS:\n${colLines}\n\nITEMS TO ORGANIZE:\n${itemLines}`,
      },
    ],
  });

  const parsed = safeJson(raw);

  const titleOf = (id: string) => allItems.find((i: any) => i.id === id)?.title ?? "Untitled";
  const nameOf = (id: string) => cols.find((c: any) => c.id === id)?.name ?? "Collection";
  const validItem = (id: string) => allItems.some((i: any) => i.id === id);
  const validCol = (id: string) => cols.some((c: any) => c.id === id);

  const actions: OrganizeAction[] = [];
  let gi = 0;
  for (const a of parsed) {
    if (a.type === "add" && validItem(a.itemId) && validCol(a.collectionId)) {
      const already = memberships.some(
        (m: any) => m.item_id === a.itemId && m.collection_id === a.collectionId,
      );
      if (already) continue;
      actions.push({
        type: "add",
        itemId: a.itemId,
        itemTitle: titleOf(a.itemId),
        collectionId: a.collectionId,
        collectionName: nameOf(a.collectionId),
        reason: String(a.reason ?? ""),
      });
    } else if (a.type === "create" && a.name) {
      const ids: string[] = (a.itemIds ?? []).filter(validItem);
      if (!ids.length) continue;
      actions.push({
        type: "create",
        name: String(a.name).slice(0, 60),
        description: String(a.description ?? "").slice(0, 280),
        icon: String(a.icon ?? "BookOpen"),
        gradient: GRADIENTS[gi++ % GRADIENTS.length]!,
        itemIds: ids,
        itemTitles: ids.map(titleOf),
        reason: String(a.reason ?? ""),
      });
    } else if (
      a.type === "merge" &&
      validCol(a.fromCollectionId) &&
      validCol(a.intoCollectionId) &&
      a.fromCollectionId !== a.intoCollectionId
    ) {
      const from = cols.find((c: any) => c.id === a.fromCollectionId) as any;
      if (!from?.ai_managed) continue; // never merge away user-created collections
      actions.push({
        type: "merge",
        fromCollectionId: a.fromCollectionId,
        fromName: nameOf(a.fromCollectionId),
        intoCollectionId: a.intoCollectionId,
        intoName: nameOf(a.intoCollectionId),
        reason: String(a.reason ?? ""),
      });
    }
  }

  const { data: run, error } = await supabase
    .from("organize_runs")
    .insert({
      user_id: userId,
      plan: actions as never,
      items_processed: candidates.length,
      status: "proposed",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { runId: (run as any).id as string, actions, itemsProcessed: candidates.length, indexed };
}

export async function applyOrganizePlan(
  supabase: AnySupabase,
  userId: string,
  runId: string,
  acceptedIndexes: number[],
): Promise<{ applied: number }> {
  const { data: run, error } = await supabase
    .from("organize_runs")
    .select("id, plan")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!run) throw new Error("Organize run not found");

  const actions = ((run as any).plan ?? []) as OrganizeAction[];
  const chosen = acceptedIndexes
    .map((i) => actions[i])
    .filter((a): a is OrganizeAction => Boolean(a));

  let applied = 0;
  for (const a of chosen) {
    if (a.type === "add") {
      await supabase
        .from("item_collections")
        .upsert({ item_id: a.itemId, collection_id: a.collectionId, user_id: userId } as never);
      applied++;
    } else if (a.type === "create") {
      const { data: col, error: cErr } = await supabase
        .from("collections")
        .insert({
          user_id: userId,
          name: a.name,
          description: a.description || null,
          icon: a.icon,
          ai_managed: true,
          cover_gradient: a.gradient,
        } as never)
        .select("id")
        .single();
      if (cErr) continue;
      const colId = (col as any).id as string;
      await supabase.from("item_collections").upsert(
        a.itemIds.map((itemId) => ({ item_id: itemId, collection_id: colId, user_id: userId })) as never,
      );
      applied++;
    } else if (a.type === "merge") {
      const { data: rows } = await supabase
        .from("item_collections")
        .select("item_id")
        .eq("collection_id", a.fromCollectionId);
      if (rows?.length) {
        await supabase.from("item_collections").upsert(
          rows.map((r: any) => ({
            item_id: r.item_id,
            collection_id: a.intoCollectionId,
            user_id: userId,
          })) as never,
        );
      }
      await supabase.from("collections").delete().eq("id", a.fromCollectionId).eq("ai_managed", true);
      applied++;
    }
  }

  await supabase.from("organize_runs").update({ status: "applied" }).eq("id", runId);
  return { applied };
}

function safeJson(raw: string): any[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed.actions) ? parsed.actions : [];
  } catch {
    return [];
  }
}
