import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listItems, type LibraryItem } from "@/lib/library.functions";
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
} from "lucide-react";

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

function LibraryPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
    refetchInterval: (q) => {
      const list = (q.state.data as LibraryItem[] | undefined) ?? [];
      return list.some((i) => i.status === "processing" || i.status === "pending") ? 4000 : false;
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
            Your library
          </h1>
          <p className="mt-2 text-muted-foreground">
            {items.length === 0
              ? "Your quiet corner of the internet. Add something to begin."
              : `${items.length} ${items.length === 1 ? "item" : "items"} — remembered and understood.`}
          </p>
        </div>
        <Link to="/upload">
          <Button className="rounded-full bg-gradient-to-r from-coral to-rose px-5 text-primary-foreground shadow-[var(--shadow-soft)]">
            <Plus className="mr-1.5 h-4 w-4" /> Add to library
          </Button>
        </Link>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-64 rounded-3xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: LibraryItem }) {
  const Icon = kindIcon[item.kind] ?? StickyNote;
  const processing = item.status === "pending" || item.status === "processing";

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
          (processing ? "Lumen is understanding this…" : item.status === "failed" ? item.error_message ?? "Analysis failed." : "Not analyzed yet.")}
      </p>

      {item.tags && item.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] text-foreground/70 backdrop-blur"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{new Date(item.created_at).toLocaleDateString()}</span>
        {processing && (
          <span className="inline-flex items-center gap-1 text-coral">
            <Loader2 className="h-3 w-3 animate-spin" /> Understanding…
          </span>
        )}
        {item.status === "failed" && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="glass mx-auto mt-8 max-w-xl rounded-3xl p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="font-display text-2xl font-semibold">Your library is waiting</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload a video, paste a YouTube link, or drop in a PDF. Lumen will read, watch, and remember everything.
      </p>
      <Link to="/upload">
        <Button className="mt-6 rounded-full bg-gradient-to-r from-coral to-rose px-6 py-5 text-primary-foreground shadow-[var(--shadow-soft)]">
          <Plus className="mr-1.5 h-4 w-4" /> Add your first item
        </Button>
      </Link>
    </div>
  );
}
