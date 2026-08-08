import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const indexLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { force?: boolean; itemIds?: string[]; maxItems?: number } | undefined) =>
    z
      .object({
        force: z.boolean().optional(),
        itemIds: z.array(z.string().uuid()).optional(),
        maxItems: z.number().int().min(1).max(50).optional(),
      })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { indexUserItems } = await import("./embeddings.server");
    return indexUserItems(context.supabase as never, context.userId, key, {
      force: data.force,
      itemIds: data.itemIds,
      maxItems: data.maxItems,
    });
  });
