import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getCollectionWithItems } from "@/lib/library.functions";
import { setCollectionAiManaged } from "@/lib/organize.functions";
import { ScopedChatPanel } from "@/components/library/ScopedChatPanel";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/collection/$id")({
  component: CollectionPage,
});

function CollectionPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollectionWithItems({ data: { id } }),
  });

  const toggleAi = useMutation({
    mutationFn: (aiManaged: boolean) => setCollectionAiManaged({ data: { id, aiManaged } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection", id] });
      toast.success(t("collectionChat.aiManagedSaved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="glass h-64 rounded-3xl" />;
  if (!data) return <div>Not found.</div>;

  const titleById = Object.fromEntries(data.items.map((it) => [it.id, it.title]));
  const collection = data.collection as typeof data.collection & { ai_managed?: boolean };

  return (
    <div className="mx-auto max-w-7xl">
      <Link to="/library" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Library
      </Link>
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
          <BookOpen className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{data.collection.name}</h1>
          {data.collection.description && (
            <p className="mt-1 text-muted-foreground">{data.collection.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{data.items.length} items</p>
        </div>
        <label className="ml-auto flex items-center gap-2 rounded-full bg-card/70 px-4 py-2 text-xs text-muted-foreground">
          <Switch
            checked={Boolean(collection.ai_managed)}
            onCheckedChange={(v) => toggleAi.mutate(v)}
          />
          {t("collectionChat.aiManaged")}
        </label>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div>
          {data.items.length === 0 ? (
            <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
              This shelf is empty. Open an item and add it here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {data.items.map((it) => (
                <Link
                  key={it.id}
                  to="/item/$id"
                  params={{ id: it.id }}
                  className="glass block rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]"
                >
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {it.kind} · {it.source}
                  </div>
                  <div className="mt-1 font-display text-lg font-semibold line-clamp-2">{it.title}</div>
                  {it.summary_short && (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{it.summary_short}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <ScopedChatPanel
          collectionId={id}
          titleById={titleById}
          className="h-[70vh] lg:sticky lg:top-6"
          suggestions={[
            t("collectionChat.s1"),
            t("collectionChat.s2"),
            t("collectionChat.s3"),
            t("collectionChat.s4"),
          ]}
        />
      </div>
    </div>
  );
}
