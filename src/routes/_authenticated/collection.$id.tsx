import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getCollectionWithItems } from "@/lib/library.functions";
import { ArrowLeft, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/collection/$id")({
  component: CollectionPage,
});

function CollectionPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["collection", id],
    queryFn: () => getCollectionWithItems({ data: { id } }),
  });

  if (isLoading) return <div className="glass h-64 rounded-3xl" />;
  if (!data) return <div>Not found.</div>;

  return (
    <div className="mx-auto max-w-6xl">
      <Link to="/library" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Library
      </Link>
      <header className="mb-8 flex items-center gap-4">
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
      </header>

      {data.items.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
          This shelf is empty. Open an item and add it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
