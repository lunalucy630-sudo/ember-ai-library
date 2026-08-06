import { ScopedChatPanel } from "@/components/library/ScopedChatPanel";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRelatedResource,
  analyzeItem,
  createCollection,
  deleteItem,
  getItem,
  listCollections,
  listItems,
  removeRelatedResource,
  toggleItemInCollection,
  updateItem,
} from "@/lib/library.functions";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Link2,
  Pencil,
  X,
  Library,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/item/$id")({
  component: ItemDetail,
  validateSearch: (search: Record<string, unknown>): { t?: number; s?: string } => ({
    t: search.t != null && !Number.isNaN(Number(search.t)) ? Number(search.t) : undefined,
    s: typeof search.s === "string" && search.s ? search.s : undefined,
  }),
});

function ItemDetail() {
  const { id } = Route.useParams();
  const { t: startAt, s: sectionQuery } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [seek, setSeek] = useState<number | null>(startAt ?? null);

  useEffect(() => {
    if (startAt != null) setSeek(startAt);
  }, [startAt]);

  useEffect(() => {
    if (seek == null) return;
    const el = mediaRef.current;
    if (el) {
      try {
        el.currentTime = seek;
        void el.play()?.catch(() => {});
      } catch {
        /* media not ready yet */
      }
    }
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [seek]);

  useEffect(() => {
    if (!sectionQuery) return;
    const timer = setTimeout(
      () => transcriptRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      400,
    );
    return () => clearTimeout(timer);
  }, [sectionQuery]);



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
  const related = data.related ?? [];
  const relatedTargets = data.relatedTargets ?? {};
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
                key={seek ?? "start"}
                src={`${youtubeEmbed(item.source_url)}${youtubeEmbed(item.source_url).includes("?") ? "&" : "?"}start=${seek ?? 0}${seek ? "&autoplay=1" : ""}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={item.title}
              />
            ) : playbackUrl ? (
              <video ref={mediaRef} src={playbackUrl} controls className="h-full w-full" />
            ) : null}
          </div>
        )}
        {item.kind === "audio" && playbackUrl && (
          <div className="p-6"><audio ref={mediaRef} src={playbackUrl} controls className="w-full" /></div>
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
              <EditDetailsDialog
                itemId={item.id}
                title={item.title}
                description={item.description}
                thumbnail={item.manual_thumbnail_url ?? null}
              />
              <Button
                onClick={() => reanalyze.mutate()}
                disabled={reanalyze.isPending || processing}
                variant="outline"
                className="rounded-full bg-card/70 backdrop-blur"
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
            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-card/70 p-4 text-sm text-foreground/80">
              <Loader2 className="h-4 w-4 animate-spin text-coral" />
              Ember is understanding this item — transcript, summary, and tags coming up.
            </div>
          )}

          {item.status === "failed" && (
            <div className="mt-6 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              {item.error_message ?? "Analysis failed. Try re-analyzing."}
            </div>
          )}

          {item.source === "instagram" && !item.summary_short && (
            <div className="mt-6 rounded-2xl bg-card/70 p-4 text-sm text-foreground/80">
              Instagram limits automated fetching for Reels. Use "Edit details" to add a
              description and thumbnail so Ember can remember what this is.
            </div>
          )}

          {!processing && (
            <section className="mt-8">
              <SectionHeader icon={Sparkles} title="Summary" />
              <p className="mt-3 text-lg leading-relaxed text-foreground/90">
                {item.summary_short ??
                  item.description ??
                  (item.raw_content ? item.raw_content.slice(0, 400) : null) ??
                  "Summary unavailable — try re-analyzing this item."}
              </p>
            </section>
          )}

          {item.key_points && item.key_points.length > 0 && (
            <section className="mt-8">
              <SectionHeader title="Key takeaways" />
              <ul className="mt-3 space-y-2">
                {item.key_points.map((p, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-card/60 p-4 text-sm">
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
                {(item.timestamps as Array<{ time: string; label: string }>).map((ts, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSeek(timeToSeconds(ts.time) ?? 0)}
                    className="flex w-full items-center gap-3 rounded-xl bg-card/60 px-4 py-2 text-left text-sm transition hover:shadow-[var(--shadow-soft)]"
                  >
                    <span className="rounded-md bg-gradient-to-r from-coral to-rose px-2 py-0.5 font-mono text-[11px] text-primary-foreground">
                      {ts.time}
                    </span>
                    <span className="text-foreground/85">{ts.label}</span>
                  </button>
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
                  <span key={t} className="rounded-full bg-card/70 px-3 py-1 text-xs text-foreground/80">#{t}</span>
                ))}
              </div>
            </section>
          )}

          {item.transcript && (
            <section className="mt-8">
              <SectionHeader title="Transcript" />
              <div className="mt-3 max-h-96 overflow-y-auto rounded-2xl bg-card/70 p-4 text-sm leading-relaxed text-foreground/85">
                {item.transcript.split("\n").map((line, i) => <p key={i} className="mb-2">{line}</p>)}
              </div>
            </section>
          )}

          <RelatedMaterials
            itemId={item.id}
            related={related}
            targets={relatedTargets}
          />

          <section className="mt-8">
            <ScopedChatPanel
              itemId={item.id}
              titleById={{ [item.id]: item.title }}
              className="h-[60vh]"
            />
          </section>


          {item.raw_content && item.kind === "note" && (
            <section className="mt-8">
              <SectionHeader title="Your note" />
              <div className="prose prose-sm mt-3 max-w-none whitespace-pre-wrap rounded-2xl bg-card/70 p-4 text-foreground/85">
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
        <Button variant="outline" className="rounded-full bg-card/70 backdrop-blur">
          <BookOpen className="mr-1.5 h-4 w-4" /> Collections
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl border-white/70 bg-card/95 p-3 backdrop-blur-xl">
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
            className="h-9 rounded-xl bg-card/80 text-sm"
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

type RelatedRow = {
  id: string;
  kind: string;
  url: string | null;
  target_item_id: string | null;
  title: string;
  description: string | null;
};

function RelatedMaterials({
  itemId,
  related,
  targets,
}: {
  itemId: string;
  related: RelatedRow[];
  targets: Record<string, { id: string; title: string; kind: string }>;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [mode, setMode] = useState<null | "url" | "item">(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const { data: allItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
    enabled: mode === "item",
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["item", itemId] });

  const addUrl = useMutation({
    mutationFn: () =>
      addRelatedResource({
        data: { itemId, kind: "url", url: url.trim(), title: title.trim() || url.trim() },
      }),
    onSuccess: () => {
      setUrl("");
      setTitle("");
      setMode(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add link"),
  });

  const addItem = useMutation({
    mutationFn: (target: { id: string; title: string }) =>
      addRelatedResource({
        data: { itemId, kind: "item", targetItemId: target.id, title: target.title },
      }),
    onSuccess: () => {
      setMode(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not attach item"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeRelatedResource({ data: { id } }),
    onSuccess: invalidate,
  });

  return (
    <section className="mt-8">
      <SectionHeader icon={Link2} title={t("item.relatedTitle")} />

      <div className="mt-3 space-y-2">
        {related.length === 0 && (
          <p className="rounded-2xl bg-card/60 p-4 text-sm text-muted-foreground">
            {t("item.relatedEmpty")}
          </p>
        )}
        {related.map((r) => {
          const target = r.target_item_id ? targets[r.target_item_id] : undefined;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-card/60 px-4 py-3 text-sm"
            >
              {r.kind === "item" && target ? (
                <Link
                  to="/item/$id"
                  params={{ id: target.id }}
                  className="flex min-w-0 items-center gap-2 hover:underline"
                >
                  <Library className="h-3.5 w-3.5 shrink-0 text-coral" />
                  <span className="truncate">{r.title}</span>
                </Link>
              ) : (
                <a
                  href={r.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-coral" />
                  <span className="truncate">{r.title}</span>
                </a>
              )}
              <button
                onClick={() => remove.mutate(r.id)}
                aria-label={t("item.remove")}
                className="rounded-full p-1 text-muted-foreground hover:bg-card/80 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-card/70 backdrop-blur"
          onClick={() => setMode(mode === "url" ? null : "url")}
        >
          <Link2 className="mr-1.5 h-3.5 w-3.5" /> {t("item.addLink")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full bg-card/70 backdrop-blur"
          onClick={() => setMode(mode === "item" ? null : "item")}
        >
          <Library className="mr-1.5 h-3.5 w-3.5" /> {t("item.addFromLibrary")}
        </Button>
      </div>

      {mode === "url" && (
        <div className="mt-3 space-y-2 rounded-2xl bg-card/70 p-4">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="rounded-xl bg-card/80"
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("item.linkTitle")}
            className="rounded-xl bg-card/80"
          />
          <Button
            size="sm"
            disabled={!url.trim() || addUrl.isPending}
            onClick={() => addUrl.mutate()}
            className="rounded-full bg-gradient-to-r from-coral to-rose text-primary-foreground"
          >
            {t("item.add")}
          </Button>
        </div>
      )}

      {mode === "item" && (
        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-card/70 p-3">
          {allItems
            .filter((i) => i.id !== itemId)
            .map((i) => (
              <button
                key={i.id}
                onClick={() => addItem.mutate({ id: i.id, title: i.title })}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-blush/40"
              >
                <Library className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{i.title}</span>
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

function EditDetailsDialog({
  itemId,
  title,
  description,
  thumbnail,
}: {
  itemId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title,
    description: description ?? "",
    thumb: thumbnail ?? "",
  });

  const save = useMutation({
    mutationFn: () =>
      updateItem({
        data: {
          id: itemId,
          title: form.title.trim(),
          description: form.description.trim(),
          manual_thumbnail_url: form.thumb.trim() ? form.thumb.trim() : null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["item", itemId] });
      qc.invalidateQueries({ queryKey: ["items"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full bg-card/70 backdrop-blur">
          <Pencil className="mr-1.5 h-4 w-4" /> {t("item.editDetails")}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">{t("item.editDetails")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("item.linkTitle")}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("item.descriptionLabel")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("item.descriptionPh")}
              className="min-h-24 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("item.thumbnailLabel")}</Label>
            <Input
              value={form.thumb}
              onChange={(e) => setForm({ ...form, thumb: e.target.value })}
              placeholder={t("item.thumbnailPh")}
              className="rounded-xl"
            />
          </div>
          <Button
            disabled={!form.title.trim() || save.isPending}
            onClick={() => save.mutate()}
            className="w-full rounded-full bg-gradient-to-r from-coral to-rose text-primary-foreground"
          >
            {t("item.save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
