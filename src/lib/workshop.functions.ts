import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Fae's Workshop: a private, AI-free workspace with one-time invitations.
 *
 * Tokens are generated with 256 bits of randomness and only their SHA-256
 * hash is stored. The raw token lives in the invite link and nowhere else.
 */

export const WORKSHOP_SLUG = "faes-workshop";
export const WORKSHOP_NAME = "Fae's Workshop";
export const WORKSHOP_SUBTITLE = "Embers to Inferno";
const DEFAULT_EXPIRY_DAYS = 7;

export interface Invitation {
  id: string;
  invitee_label: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  status: "pending" | "accepted" | "revoked" | "expired";
}

export interface WorkshopStatus {
  workspace: { id: string; name: string; slug: string; ai_allowed: boolean } | null;
  invitations: Invitation[];
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function statusOf(row: {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): Invitation["status"] {
  if (row.accepted_at) return "accepted";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "pending";
}

/** Owner view: the workshop workspace (if created) and its invitations. */
export const getWorkshopStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkshopStatus> => {
    const { supabase, userId } = context;
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, slug, ai_allowed")
      .eq("owner_id", userId)
      .eq("kind", "workshop")
      .maybeSingle();
    if (!ws) return { workspace: null, invitations: [] };

    const { data: rows } = await supabase
      .from("workspace_invitations")
      .select("id, invitee_label, expires_at, accepted_at, revoked_at, created_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false });

    return {
      workspace: ws,
      invitations: (rows ?? []).map((r) => ({ ...r, status: statusOf(r) })),
    };
  });

/** Owner creates the Workshop workspace. AI is forced off (also enforced in DB). */
export const createWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .eq("kind", "workshop")
      .maybeSingle();
    if (existing) return { id: existing.id };

    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        owner_id: userId,
        name: WORKSHOP_NAME,
        slug: WORKSHOP_SLUG,
        kind: "workshop",
        icon: "sparkles",
        accent: "plum",
        ai_allowed: false,
        is_default: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

/** Owner generates a one-time invite link. Returns the raw token exactly once. */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { label?: string; days?: number }) =>
    z
      .object({
        label: z.string().trim().max(80).optional(),
        days: z.number().int().min(1).max(30).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .eq("kind", "workshop")
      .maybeSingle();
    if (!ws) throw new Error("Create the Workshop first.");

    // Any older pending invitation is revoked: there is only ever one live link.
    await supabase
      .from("workspace_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("workspace_id", ws.id)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const token = randomToken();
    const token_hash = await sha256Hex(token);
    const expires_at = new Date(
      Date.now() + (data.days ?? DEFAULT_EXPIRY_DAYS) * 86_400_000,
    ).toISOString();

    const { error } = await supabase.from("workspace_invitations").insert({
      workspace_id: ws.id,
      created_by: userId,
      token_hash,
      invitee_label: data.label || "Fae",
      expires_at,
    });
    if (error) throw new Error(error.message);
    return { token, expires_at };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("accepted_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Owner removes a member's access (content stays). */
export const removeWorkshopMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { memberId: string }) =>
    z.object({ memberId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWorkshopMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId)
      .eq("kind", "workshop")
      .maybeSingle();
    if (!ws) return [] as Array<{ id: string; user_id: string; role: string; created_at: string }>;
    const { data } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", ws.id);
    return data ?? [];
  });

/**
 * Public preview of an invite: is this link still valid, and for what?
 * Token-gated; reveals only the workshop name. Uses the admin client because
 * the invitee is not yet a member and cannot read the row under RLS.
 */
export const previewInvitation = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(20).max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token_hash = await sha256Hex(data.token);
    const { data: inv } = await supabaseAdmin
      .from("workspace_invitations")
      .select("id, invitee_label, expires_at, accepted_at, revoked_at, workspace_id")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!inv) return { valid: false as const, reason: "not_found" as const };
    const status = statusOf(inv);
    if (status !== "pending") return { valid: false as const, reason: status };
    return {
      valid: true as const,
      inviteeLabel: inv.invitee_label,
      expiresAt: inv.expires_at,
      workshopName: WORKSHOP_NAME,
      subtitle: WORKSHOP_SUBTITLE,
    };
  });

/** Signed-in invitee accepts: token is consumed, membership is created. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(20).max(120) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token_hash = await sha256Hex(data.token);

    const { data: inv } = await supabaseAdmin
      .from("workspace_invitations")
      .select("id, workspace_id, created_by, expires_at, accepted_at, revoked_at")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!inv) return { ok: false as const, reason: "not_found" as const };
    const status = statusOf(inv);
    if (status !== "pending") return { ok: false as const, reason: status };
    if (inv.created_by === context.userId) {
      return { ok: false as const, reason: "owner" as const };
    }

    // Atomically consume the token (guards against double-accept races).
    const { data: consumed } = await supabaseAdmin
      .from("workspace_invitations")
      .update({ accepted_at: new Date().toISOString(), accepted_by: context.userId })
      .eq("id", inv.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (!consumed) return { ok: false as const, reason: "accepted" as const };

    const { error } = await supabaseAdmin.from("workspace_members").insert({
      workspace_id: inv.workspace_id,
      user_id: context.userId,
      role: "member",
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true as const, workspaceId: inv.workspace_id };
  });

/** Workspaces the signed-in user was invited into (not ones they own). */
export const getMyWorkshopMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships } = await supabase
      .from("workspace_members")
      .select("id, workspace_id")
      .eq("user_id", userId);
    if (!memberships?.length) return null;
    const ids = memberships.map((m) => m.workspace_id);
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, name, slug, kind, ai_allowed")
      .in("id", ids)
      .eq("kind", "workshop")
      .limit(1)
      .maybeSingle();
    if (!ws) return null;
    const m = memberships.find((x) => x.workspace_id === ws.id)!;
    return { membershipId: m.id, workspace: ws };
  });

export const leaveWorkshop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { membershipId: string }) =>
    z.object({ membershipId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("workspace_members")
      .delete()
      .eq("id", data.membershipId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
