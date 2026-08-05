import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { OrganizeAction, OrganizePlan } from "./organize.server";

export type { OrganizeAction, OrganizePlan };

export const proposeOrganize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { force?: boolean } | undefined) =>
    z.object({ force: z.boolean().optional() }).default({}).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { proposeOrganizePlan } = await import("./organize.server");
    return proposeOrganizePlan(context.supabase as never, context.userId, key, { force: data.force });
  });

export const applyOrganize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { runId: string; acceptedIndexes: number[] }) =>
    z
      .object({ runId: z.string().uuid(), acceptedIndexes: z.array(z.number().int().min(0)) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { applyOrganizePlan } = await import("./organize.server");
    return applyOrganizePlan(context.supabase as never, context.userId, data.runId, data.acceptedIndexes);
  });

export const setCollectionAiManaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; aiManaged: boolean }) =>
    z.object({ id: z.string().uuid(), aiManaged: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("collections")
      .update({ ai_managed: data.aiManaged })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
