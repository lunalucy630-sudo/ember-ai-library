import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { analyzeItem, listItems, type LibraryItem } from "@/lib/library.functions";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Video,
  FileText,
  Image as ImageIcon,
  Music,
  StickyNote,
  Link as LinkIcon,
  Sparkles,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  ArrowUpDown,
} from "lucide-react";
import { AutoOrganizeButton } from "@/components/library/AutoOrganizeButton";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

const kindIcon = {
  video: Video,
  document: FileText,
  image: ImageIcon,
  audio: Music,
  note: StickyNote,
  link: LinkIcon,
} as const;

const KINDS = ["video", "document", "image", "audio", "note", "link"] as const;

function LibraryPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [sort, setSort] = useState<"new" | "old" | "title">("new");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
    refetchInterval: (query) => {
      const list = (query.state.data as LibraryItem[] | undefined) ?? [];
      return list.some((i) => i.status === "processing" || i.status === "pending") ? 4000 : false;
    },
  });

  const broken = items.filter(
    (i) => i.status === "failed" || (i.status === "ready" && !i.summary_short),
  );

  const retryAll = useMutation({
    mutationFn: async () => {
      for (const it of broken) {
        try {
          await analyzeItem({ data: { id: it.id } });
        } catch {
          /* surfaced per-card */
        }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.filter((i) => {
      if (kind && i.kind !== kind) return false;
      if (onlyFailed && i.status !== "failed") return false;
      if (!needle) return true;
      return [i.title, i.summary_short, ...(i.tags ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
    list = [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      const d = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "old" ? d : -d;
    });
    return list;
  }, [items, q, kind, onlyFailed, sort]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            {t("library.title")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {items.length === 0
              ? t("library.emptyLead")
              : t("library.count", { count: items.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {broken.length > 0 && (
            <Button
              variant="outline"
              onClick={() => retryAll.mutate()}
              disabled={retryAll.isPending}
              className="rounded-full"
            >
              {retryAll.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              {t("library.retryAll", { count: broken.length })}
            </Button>
          )}
          <AutoOrganizeButton />
          <Link to="/upload">
            <Button className="rounded-full bg-gradient-to-r from-coral to-rose px-5 text-primary-foreground shadow-[var(--shadow-soft)]">
              <Plus className="mr-1.5 h-4 w-4" /> {t("library.add")}
            </Button>
          </Link>
        </div>
      </header>

      {items.length > 0 && (
        <div className="glass mb-6 flex flex-wrap items-center gap-2 rounded-3xl p-3">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-full bg-card/60 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("library.filterPlaceholder")}
              className="h-9 border-none bg-transparent shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={!kind && !onlyFailed} onClick={() => { setKind(null); setOnlyFailed(false); }}>
              {t("library.all")}
            </Chip>
            {KINDS.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(kind === k ? null : k)}>
                {t(`kinds.${k}`, { defaultValue: k })}
              </Chip>
            ))}
            <Chip active={onlyFailed} onClick={() => setOnlyFailed(!onlyFailed)}>
              {t("library.failedShort")}
            </Chip>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs text-muted-foreground"
            onClick={() => setSort(sort === "new" ? "old" : sort === "old" ? "title" : "new")}
          >
            <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
            {t(`library.sort.${sort}`)}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-64 rounded-3xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          {t("library.noFilterMatch")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((it) => (
            <ItemCard key={it.id} item={it} />
          ))}
        </div>
      )}

    </div>
  );
}

function ItemCard({ item }: { item: LibraryItem }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const Icon = kindIcon[item.kind] ?? StickyNote;
  const reanalyze = useMutation({
    mutationFn: () => analyzeItem({ data: { id: item.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["item", item.id] });
    },
  });
  const processing =
    item.status === "pending" || item.status === "processing" || reanalyze.isPending;
  const errorText =
    (reanalyze.error instanceof Error ? reanalyze.error.message : null) ??
    (item.status === "failed" ? item.error_message ?? t("library.failed") : null);


  return (
    <Link
      to="/item/$id"
      params={{ id: item.id }}
      className="group animate-float-in glass relative flex flex-col overflow-hidden rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-coral/90 to-rose/90 text-primary-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {item.kind} · {item.source}
        </div>
      </div>

      <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug">
        {item.title}
      </h3>

      <p className="mt-2 line-clamp-3 min-h-[3.5rem] text-sm text-muted-foreground">
        {item.summary_short ??
          (processing ? t("library.processing") : errorText ?? t("library.notAnalyzed"))}
      </p>

      {errorText && !processing && (
        <p className="mt-2 line-clamp-3 rounded-2xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {errorText}
        </p>
      )}

      {item.tags && item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full bg-card/70 px-2.5 py-0.5 text-[11px] text-foreground/70 backdrop-blur"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{new Date(item.created_at).toLocaleDateString()}</span>
        <div className="flex items-center gap-2">
          {processing ? (
            <span className="inline-flex items-center gap-1 text-coral">
              <Loader2 className="h-3 w-3 animate-spin" />
              {reanalyze.isPending ? t("library.reanalyzing") : t("library.understanding")}
            </span>
          ) : errorText ? (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" /> {t("library.failedShort")}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={processing}
            aria-label={t("item.reanalyze")}
            title={t("item.reanalyze")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              reanalyze.mutate();
            }}
            className="h-7 rounded-full px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reanalyze.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

    </Link>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="glass mx-auto mt-8 max-w-xl rounded-3xl p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold">{t("library.emptyTitle")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("library.emptyBody")}
      </p>
      <Link to="/upload">
        <Button className="mt-6 rounded-full bg-gradient-to-r from-coral to-rose px-6 py-5 text-primary-foreground shadow-[var(--shadow-soft)]">
          <Plus className="mr-1.5 h-4 w-4" /> {t("library.emptyCta")}
        </Button>
      </Link>
    </div>
  );
}
