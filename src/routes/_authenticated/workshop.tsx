import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookLock, Users, Film, Palette, Sprout, FlaskConical, ShieldOff } from "lucide-react";
import { getMyWorkshopMembership, getWorkshopStatus, WORKSHOP_NAME, WORKSHOP_SUBTITLE } from "@/lib/workshop.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/workshop")({
  head: () => ({
    meta: [
      { title: "Fae's Workshop — Embers to Inferno" },
      { name: "description", content: "A private, AI-free creative studio for Embers to Inferno." },
      { property: "og:title", content: "Fae's Workshop — Embers to Inferno" },
      { property: "og:description", content: "Story Vault, Characters, Episodes, Canvas Archive, Idea Garden and Experiments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkshopPage,
});

const SECTIONS = [
  { key: "storyVault", icon: BookLock },
  { key: "characters", icon: Users },
  { key: "episodes", icon: Film },
  { key: "canvas", icon: Palette },
  { key: "ideaGarden", icon: Sprout },
  { key: "experiments", icon: FlaskConical },
] as const;

function WorkshopPage() {
  const { t } = useTranslation();
  const { data: membership, isLoading: l1 } = useQuery({
    queryKey: ["my-workshop"],
    queryFn: () => getMyWorkshopMembership(),
  });
  const { data: owned, isLoading: l2 } = useQuery({
    queryKey: ["workshop-status"],
    queryFn: () => getWorkshopStatus(),
  });

  const workspace = membership?.workspace ?? owned?.workspace ?? null;

  if (l1 || l2) return <p className="text-muted-foreground">{t("common.loading")}</p>;

  if (!workspace) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-3xl font-semibold">🧚 {WORKSHOP_NAME}</h1>
        <p className="mt-2 text-muted-foreground">{t("workshop.noAccess")}</p>
        <Button asChild className="mt-6 rounded-2xl">
          <Link to="/settings">{t("nav.settings")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10 rounded-3xl border border-plum/30 bg-gradient-to-br from-plum/15 via-card/60 to-card/50 p-8 backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-plum">{WORKSHOP_SUBTITLE}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">🧚 {workspace.name}</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">{t("workshop.welcome")}</p>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldOff className="h-3.5 w-3.5" /> {t("workshop.aiLocked")}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <div
            key={s.key}
            className="rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur transition-colors hover:border-plum/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-plum/15 text-plum">
              <s.icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-display text-lg font-semibold">{t(`workshop.sections.${s.key}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t(`workshop.sections.${s.key}.hint`)}</p>
            <p className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground/70">{t("workshop.comingSoon")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
