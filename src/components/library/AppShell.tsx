import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listCollections } from "@/lib/library.functions";
import { Home, Upload, Search, MessagesSquare, Flame, LogOut, BookOpen, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { CreateCollectionDialog } from "./CreateCollectionDialog";
import { LangThemeSwitcher } from "./LangThemeSwitcher";
import { useTranslation } from "react-i18next";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/50 bg-sidebar/70 p-5 backdrop-blur-xl md:block">
          <SidebarContent />
        </aside>
        <div className="flex-1 min-w-0">
          <MobileTopBar />
          <main className="px-4 py-6 md:px-10 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function MobileTopBar() {
  const { t } = useTranslation();
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/50 bg-background/70 px-4 py-3 backdrop-blur-xl md:hidden">
      <Link to="/library" className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-coral to-rose text-primary-foreground">
          <Flame className="h-4 w-4" />
        </div>
        <span className="font-display text-lg font-semibold">{t("brand.name")}</span>
      </Link>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-none bg-sidebar/95 p-5 backdrop-blur-xl">
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const state = useRouterState();
  const pathname = state.location.pathname;
  const [openCreateCollection, setOpenCreateCollection] = useState(false);

  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(),
  });

  const nav = [
    { to: "/library", label: t("nav.library"), icon: Home },
    { to: "/upload", label: t("nav.add"), icon: Upload },
    { to: "/search", label: t("nav.search"), icon: Search },
    { to: "/chat", label: t("nav.chat"), icon: MessagesSquare },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/" });
  };

  return (
    <div className="flex h-full flex-col">
      <Link to="/library" className="mb-8 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
          <Flame className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-lg font-semibold leading-none">{t("brand.name")}</div>
          <div className="text-[11px] text-muted-foreground">{t("brand.tagline")}</div>
        </div>
      </Link>

      <nav className="space-y-1">
        {nav.map((n) => {
          const active = pathname === n.to || pathname.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-gradient-to-r from-coral/25 to-rose/20 text-foreground font-medium"
                  : "text-foreground/70 hover:bg-card/60"
              }`}
            >
              <n.icon className={`h-4 w-4 ${active ? "text-coral" : ""}`} />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8">
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("nav.collections")}
          </div>
          <button
            onClick={() => setOpenCreateCollection(true)}
            className="rounded-full p-1 text-muted-foreground hover:bg-card/70 hover:text-foreground"
            aria-label={t("nav.newCollection")}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[36vh] space-y-0.5 overflow-y-auto pr-1">
          {collections.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Save something and AI will suggest shelves.
            </p>
          )}
          {collections.map((c) => (
            <Link
              key={c.id}
              to="/collection/$id"
              params={{ id: c.id }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/75 hover:bg-card/60"
            >
              <BookOpen className="h-3.5 w-3.5 opacity-60" />
              <span className="truncate">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6">
        <LangThemeSwitcher />
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-foreground/70 hover:bg-card/60"
        >
          <LogOut className="h-4 w-4" /> {t("nav.signOut")}
        </button>
      </div>

      <CreateCollectionDialog open={openCreateCollection} onOpenChange={setOpenCreateCollection} />
    </div>
  );
}
