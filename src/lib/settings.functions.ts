import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * AI is an OPTIONAL layer in Ember. These settings are the single source of
 * truth for whether any model may be called on a user's behalf.
 *
 * off    — never call a model, anywhere
 * ask    — ask before each AI action
 * manual — AI only when the user explicitly triggers it (no confirm dialogs)
 * auto   — analyze new items automatically
 */
export type AiMode = "off" | "ask" | "manual" | "auto";

export interface AiSettings {
  aiMode: AiMode;
  autoAnalyze: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  kind: string;
  icon: string | null;
  accent: string | null;
  ai_allowed: boolean;
  is_default: boolean;
}

const AI_MODES = ["off", "ask", "manual", "auto"] as const;

/** Reads settings and guarantees the user has a default workspace. */
export const getAiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiSettings & { workspaces: Workspace[] }> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("ai_mode, ai_auto_analyze")
      .eq("id", userId)
      .maybeSingle();

    let { data: workspaces } = await supabase
      .from("workspaces")
      .select("id, name, slug, kind, icon, accent, ai_allowed, is_default")
      .order("created_at", { ascending: true });

    if (!workspaces?.length) {
      const { data: created } = await supabase
        .from("workspaces")
        .insert({
          owner_id: userId,
          name: "My Library",
          slug: "library",
          kind: "library",
          ai_allowed: true,
          is_default: true,
        })
        .select("id, name, slug, kind, icon, accent, ai_allowed, is_default");
      workspaces = created ?? [];
    }

    const mode = (profile as { ai_mode?: string } | null)?.ai_mode;
    return {
      aiMode: (AI_MODES as readonly string[]).includes(mode ?? "") ? (mode as AiMode) : "ask",
      autoAnalyze: Boolean((profile as { ai_auto_analyze?: boolean } | null)?.ai_auto_analyze),
      workspaces: (workspaces ?? []) as Workspace[],
    };
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { aiMode?: AiMode; autoAnalyze?: boolean }) =>
    z
      .object({ aiMode: z.enum(AI_MODES).optional(), autoAnalyze: z.boolean().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { ai_mode?: string; ai_auto_analyze?: boolean } = {};
    if (data.aiMode) patch.ai_mode = data.aiMode;
    if (typeof data.autoAnalyze === "boolean") patch.ai_auto_analyze = data.autoAnalyze;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
