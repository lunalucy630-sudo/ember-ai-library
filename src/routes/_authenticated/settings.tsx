import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Sparkles,
  Wand2,
  Copy,
  Link2,
  Ban,
  Loader2,
  Check,
  ShieldOff,
  UserMinus,
  LogOut,
} from "lucide-react";
import { getAiSettings, updateAiSettings, type AiMode } from "@/lib/settings.functions";
import {
  createInvitation,
  createWorkshop,
  getMyWorkshopMembership,
  getWorkshopStatus,
  leaveWorkshop,
  listWorkshopMembers,
  removeWorkshopMember,
  revokeInvitation,
  WORKSHOP_NAME,
  WORKSHOP_SUBTITLE,
} from "@/lib/workshop.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangThemeSwitcher } from "@/components/library/LangThemeSwitcher";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Ember" },
      { name: "description", content: "Decide when Ember may use AI, and manage Fae's Workshop access." },
      { property: "og:title", content: "Settings — Ember" },
      { property: "og:description", content: "AI controls and Workshop invitations for your Ember library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const MODES: AiMode[] = ["off", "ask", "manual", "auto"];

function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t("nav.settings")}</h1>
        <p className="mt-2 text-muted-foreground">{t("settingsPage.sub")}</p>
      </header>

      <AiSection />
      <section className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur">
        <h2 className="font-display text-xl font-semibold">{t("settingsPage.appearance")}</h2>
        <div className="mt-4">
          <LangThemeSwitcher />
        </div>
      </section>
      <WorkshopSection />
      <MembershipSection />
    </div>
  );
}

function AiSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ai-settings"], queryFn: () => getAiSettings() });

  const save = useMutation({
    mutationFn: (patch: { aiMode?: AiMode; autoAnalyze?: boolean }) => updateAiSettings({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success(t("settingsPage.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mode = data?.aiMode ?? "ask";
  const auto = data?.autoAnalyze ?? false;
  const aiOff = mode === "off";

  return (
    <section className="rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-coral/30 to-rose/25 text-coral">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">{t("settingsPage.ai.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("settingsPage.ai.sub")}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              disabled={isLoading || save.isPending}
              onClick={() => save.mutate({ aiMode: m })}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? "border-coral/60 bg-gradient-to-br from-coral/20 to-rose/15"
                  : "border-border/60 bg-background/50 hover:bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{t(`settingsPage.ai.modes.${m}.label`)}</span>
                {active && <Check className="h-4 w-4 text-coral" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t(`settingsPage.ai.modes.${m}.hint`)}</p>
            </button>
          );
        })}
      </div>

      <div
        className={`mt-5 flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 p-4 ${
          aiOff ? "opacity-50" : ""
        }`}
      >
        <div>
          <Label htmlFor="auto-analyze" className="font-medium">
            {t("settingsPage.ai.autoAnalyze")}
          </Label>
          <p className="text-xs text-muted-foreground">{t("settingsPage.ai.autoAnalyzeHint")}</p>
        </div>
        <Switch
          id="auto-analyze"
          checked={auto && !aiOff}
          disabled={aiOff || isLoading || save.isPending}
          onCheckedChange={(v) => save.mutate({ autoAnalyze: v })}
        />
      </div>

      {aiOff && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldOff className="h-3.5 w-3.5" /> {t("settingsPage.ai.offNote")}
        </p>
      )}
    </section>
  );
}

function WorkshopSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [label, setLabel] = useState("Fae");
  const [freshLink, setFreshLink] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["workshop-status"], queryFn: () => getWorkshopStatus() });
  const { data: members = [] } = useQuery({
    queryKey: ["workshop-members"],
    queryFn: () => listWorkshopMembers(),
    enabled: Boolean(data?.workspace),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["workshop-status"] });
    qc.invalidateQueries({ queryKey: ["workshop-members"] });
  };

  const create = useMutation({
    mutationFn: () => createWorkshop(),
    onSuccess: () => {
      refresh();
      toast.success(t("workshop.created"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invite = useMutation({
    mutationFn: () => createInvitation({ data: { label } }),
    onSuccess: (r) => {
      setFreshLink(`${window.location.origin}/invite/fae/${r.token}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeInvitation({ data: { id } }),
    onSuccess: () => {
      setFreshLink(null);
      refresh();
      toast.success(t("workshop.revoked"));
    },
  });

  const remove = useMutation({
    mutationFn: (memberId: string) => removeWorkshopMember({ data: { memberId } }),
    onSuccess: () => {
      refresh();
      toast.success(t("workshop.memberRemoved"));
    },
  });

  const copy = async () => {
    if (!freshLink) return;
    await navigator.clipboard.writeText(freshLink);
    toast.success(t("workshop.copied"));
  };

  const pending = data?.invitations.filter((i) => i.status === "pending") ?? [];
  const history = data?.invitations.filter((i) => i.status !== "pending").slice(0, 5) ?? [];

  return (
    <section className="rounded-3xl border border-plum/30 bg-gradient-to-br from-plum/10 via-card/60 to-card/60 p-6 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-plum/20 text-plum">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold">🧚 {WORKSHOP_NAME}</h2>
          <p className="text-sm text-muted-foreground">
            {WORKSHOP_SUBTITLE} · {t("workshop.settingsSub")}
          </p>
        </div>
      </div>

      {!data?.workspace ? (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">{t("workshop.notCreated")}</p>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="mt-3 rounded-2xl">
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {t("workshop.create")}
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldOff className="h-3.5 w-3.5" /> {t("workshop.aiLocked")}
          </p>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
            <h3 className="font-medium">{t("workshop.inviteTitle")}</h3>
            <p className="text-xs text-muted-foreground">{t("workshop.inviteHint")}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("workshop.labelPh")}
                className="rounded-xl"
                maxLength={80}
              />
              <Button onClick={() => invite.mutate()} disabled={invite.isPending} className="rounded-xl">
                {invite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                {pending.length ? t("workshop.regenerate") : t("workshop.generate")}
              </Button>
            </div>

            {freshLink && (
              <div className="mt-3 rounded-xl border border-plum/40 bg-plum/10 p-3">
                <p className="mb-2 text-xs font-medium text-plum">{t("workshop.showOnce")}</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg bg-background/70 px-2 py-1.5 text-xs">
                    {freshLink}
                  </code>
                  <Button size="sm" variant="secondary" onClick={copy} className="rounded-lg">
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> {t("workshop.copy")}
                  </Button>
                </div>
              </div>
            )}

            {pending.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {pending.map((i) => (
                  <li key={i.id} className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-sm">
                    <span>
                      {i.invitee_label ?? "—"} ·{" "}
                      <span className="text-muted-foreground">
                        {t("workshop.expires", { date: new Date(i.expires_at).toLocaleDateString() })}
                      </span>
                    </span>
                    <button
                      onClick={() => revoke.mutate(i.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Ban className="h-3.5 w-3.5" /> {t("workshop.revoke")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium">{t("workshop.members")}</h3>
            {members.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">{t("workshop.noMembers")}</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-xl bg-card/70 px-3 py-2 text-sm">
                    <span>
                      🧚 {t("workshop.memberSince", { date: new Date(m.created_at).toLocaleDateString() })}
                    </span>
                    <button
                      onClick={() => remove.mutate(m.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <UserMinus className="h-3.5 w-3.5" /> {t("workshop.removeAccess")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {history.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">{t("workshop.history")}</summary>
              <ul className="mt-2 space-y-1">
                {history.map((i) => (
                  <li key={i.id}>
                    {new Date(i.created_at).toLocaleDateString()} · {i.invitee_label ?? "—"} ·{" "}
                    {t(`workshop.status.${i.status}`)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/** Shown only to an invitee (Fae) so she can open or leave the Workshop. */
function MembershipSection() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["my-workshop"], queryFn: () => getMyWorkshopMembership() });
  const leave = useMutation({
    mutationFn: (membershipId: string) => leaveWorkshop({ data: { membershipId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-workshop"] });
      toast.success(t("workshop.left"));
    },
  });
  if (!data) return null;
  return (
    <section className="rounded-3xl border border-plum/30 bg-card/60 p-6 backdrop-blur">
      <h2 className="font-display text-xl font-semibold">🧚 {data.workspace.name}</h2>
      <p className="text-sm text-muted-foreground">{WORKSHOP_SUBTITLE}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="rounded-2xl">
          <Link to="/workshop">{t("workshop.open")}</Link>
        </Button>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => {
            if (window.confirm(t("workshop.leaveConfirm"))) leave.mutate(data.membershipId);
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> {t("workshop.leave")}
        </Button>
      </div>
    </section>
  );
}
