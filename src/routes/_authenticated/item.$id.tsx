import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  analyzeItem,
  createCollection,
  deleteItem,
  getItem,
  listCollections,
  toggleItemInCollection,
} from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Check,
  Plus,
} from "lucide-react";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/item/$id")({
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["item", id],
    queryFn: () => getItem({ data: { id } }),
    refetchInterval: (q) => {
      const d = q.state.data as Awaited<ReturnType<typeof getItem>> | undefined;
      return d?.item.status === "pending" || d?.item.status === "processing" ? 4000 : false;
    },
  });

  const reanalyze = useMutation({
    mutationFn: () => analyzeItem({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item", id] });
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e) => toast.error("Analysis failed", { description: e instanceof Error ? e.message : "" }),
  });

  const del = useMutation({
    mutationFn: () => deleteItem({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Removed from library");
      navigate({ to: "/library" });
    },
  });

  if (isLoading) {
    return <div className="mx-auto max-w-4xl"><div className="glass h-96 rounded-3xl" /></div>;
  }
  if (error || !data) {
    return <div className="text-muted-foreground">Item not found.</div>;
  }

  const { item, playbackUrl, collections } = data;
  const processing = item.status === "pending" || item.status === "processing";

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/library" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to library
      </Link>

      <div className="glass overflow-hidden rounded-3xl">
        {item.kind === "video" && (playbackUrl || (item.source_url && (item.source === "youtube"))) && (
          <div className="aspect-video w-full bg-black/80">
            {item.source === "youtube" && item.source_url ? (
              <iframe
                src={youtubeEmbed(item.source_url)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={item.title}
              />
            ) : playbackUrl ? (
              <video src={playbackUrl} controls className="h-full w-full" />
            ) : null}
          </div>
        )}
        {item.kind === "audio" && playbackUrl && (
          <div className="p-6"><audio src={playbackUrl} controls className="w-full" /></div>
        )}
        {item.kind === "image" && playbackUrl && (
          <img src={playbackUrl} alt={item.title} className="max-h-[70vh] w-full object-contain" />
        )}

        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {item.kind} · {item.source}
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight">
                {item.title}
              </h1>
              {item.source_url && (
                <a href={item.source_url} target="_blank" rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3 w-3" /> {new URL(item.source_url).hostname}
                </a>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CollectionMenu itemId={item.id} attached={collections} />
              <Button
                onClick={() => reanalyze.mutate()}
                disabled={reanalyze.isPending || processing}
                variant="outline"
                className="rounded-full bg-white/70 backdrop-blur"
              >
                <RefreshCw className={`mr-1.5 h-4 w-4 ${reanalyze.isPending ? "animate-spin" : ""}`} />
                Re-analyze
              </Button>
              <Button
                onClick={() => confirm("Remove from your library?") && del.mutate()}
                variant="ghost"
                className="rounded-full text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {collections.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {collections.map((c) => (
                <Link
                  key={c.id}
                  to="/collection/$id"
                  params={{ id: c.id }}
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-coral/25 to-rose/20 px-3 py-1 text-xs font-medium text-foreground/80"
                >
                  <BookOpen className="h-3 w-3" /> {c.name}
                </Link>
              ))}
            </div>
          )}

          {processing && (
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white/70 p-4 text-sm text-foreground/80">
              <Loader2 className="h-4 w-4 animate-spin text-coral" />
              Lumen is understanding this item — transcript, summary, and tags coming up.
            </div>
          )}

          {item.status === "failed" && (
            <div className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              {item.error_message ?? "Analysis failed. Try re-analyzing."}
            </div>
          )}

          {item.summary_short && (
            <section className="mt-8">
              <SectionHeader icon={Sparkles} title="At a glance" />
              <p className="mt-3 text-lg leading-relaxed text-foreground/90">{item.summary_short}</p>
            </section>
          )}

          {item.key_points && item.key_points.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Key takeaways" />
              <ul className="mt-3 space-y-2">
                {item.key_points.map((p, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-white/60 p-4 text-sm">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-coral to-rose text-[10px] font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-foreground/85">{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {item.timestamps && Array.isArray(item.timestamps) && item.timestamps.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Important moments" />
              <div className="mt-3 space-y-1.5">
                {(item.timestamps as Array<{ time: string; label: string }>).map((t, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/60 px-4 py-2 text-sm">
                    <span className="rounded-md bg-gradient-to-r from-coral to-rose px-2 py-0.5 font-mono text-[11px] text-primary-foreground">
                      {t.time}
                    </span>
                    <span className="text-foreground/85">{t.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {item.summary_long && (
            <section className="mt-8">
              <SectionHeader title="Detailed summary" />
              <div className="prose prose-sm mt-3 max-w-none text-foreground/90">
                <ReactMarkdown>{item.summary_long}</ReactMarkdown>
              </div>
            </section>
          )}

          {item.tags && item.tags.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Tags" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/70 px-3 py-1 text-xs text-foreground/80">#{t}</span>
                ))}
              </div>
            </section>
          )}

          {item.transcript && (
            <section className="mt-8">
              <SectionHeader title="Transcript" />
              <div className="mt-3 max-h-96 overflow-y-auto rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-foreground/85">
                {item.transcript.split("\n").map((line, i) => <p key={i} className="mb-2">{line}</p>)}
              </div>
            </section>
          )}

          {item.raw_content && item.kind === "note" && (
            <section className="mt-8">
              <SectionHeader title="Your note" />
              <div className="prose prose-sm mt-3 max-w-none whitespace-pre-wrap rounded-2xl bg-white/70 p-4 text-foreground/85">
                {item.raw_content}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
      {Icon && <Icon className="h-3.5 w-3.5 text-coral" />}
      {title}
    </div>
  );
}

function CollectionMenu({ itemId, attached }: { itemId: string; attached: Array<{ id: string; name: string }> }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections(),
  });
  const attachedIds = new Set(attached.map((c) => c.id));

  const toggle = useMutation({
    mutationFn: (input: { collectionId: string; attach: boolean }) =>
      toggleItemInCollection({ data: { itemId, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item", itemId] });
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
  });

  const create = useMutation({
    mutationFn: (name: string) => createCollection({ data: { name } }),
    onSuccess: async (c) => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      await toggle.mutateAsync({ collectionId: c.id, attach: true });
      setNewName("");
    },
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="rounded-full bg-white/70 backdrop-blur">
          <BookOpen className="mr-1.5 h-4 w-4" /> Collections
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl border-white/70 bg-white/95 p-3 backdrop-blur-xl">
        <div className="mb-2 px-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          Add to shelves
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {collections.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No collections yet.</p>
          )}
          {collections.map((c) => {
            const on = attachedIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle.mutate({ collectionId: c.id, attach: !on })}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-blush/40"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 opacity-60" /> {c.name}
                </span>
                {on && <Check className="h-4 w-4 text-coral" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New collection…"
            className="h-9 rounded-xl bg-white/80 text-sm"
          />
          <Button
            size="icon"
            onClick={() => newName.trim() && create.mutate(newName.trim())}
            disabled={!newName.trim() || create.isPending}
            className="rounded-xl bg-gradient-to-r from-coral to-rose text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function youtubeEmbed(url: string): string {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
    else if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}
