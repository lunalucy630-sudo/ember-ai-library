import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { smartSearch } from "@/lib/search.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, Quote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "Search your library — Ember" },
      {
        name: "description",
        content:
          "Ask in your own words and Ember finds the exact moment inside your videos, notes and documents.",
      },
      { property: "og:title", content: "Search your library — Ember" },
      {
        property: "og:description",
        content: "Semantic search across everything you have saved in Ember.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Hit = {
  item: any;
  similarity: number;
  snippets: { content: string; location: string | null }[];
};

function SearchPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[] | null>(null);

  const mut = useMutation({
    mutationFn: () => smartSearch({ data: { query: q } }),
    onSuccess: (r) => setResults(r as Hit[]),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t("search.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("search.sub")}</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) mut.mutate();
        }}
        className="glass flex items-center gap-2 rounded-full p-2"
      >
        <div className="pl-3 text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search.placeholder")}
          className="h-11 flex-1 border-none bg-transparent shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          disabled={!q.trim() || mut.isPending}
          className="rounded-full bg-gradient-to-r from-coral to-rose px-5 text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          {mut.isPending ? t("search.searching") : t("search.search")}
        </Button>
      </form>

      {mut.isError && (
        <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {(mut.error as Error).message}
        </p>
      )}

      <div className="mt-8">
        {results === null ? (
          <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-coral" />
            {t("search.hint")}
          </div>
        ) : results.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center text-sm text-muted-foreground">
            {t("search.noMatch")}
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(({ item: r, similarity, snippets }) => (
              <Link
                key={r.id}
                to="/item/$id"
                params={{ id: r.id }}
                className="glass block rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    {r.kind} · {r.source}
                  </div>
                  {similarity > 0 && (
                    <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-medium text-coral">
                      {t("search.match", { pct: Math.round(similarity * 100) })}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-display text-lg font-semibold">{r.title}</div>
                {r.summary_short && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {r.summary_short}
                  </p>
                )}
                {snippets.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {snippets.map((s, i) => (
                      <div
                        key={i}
                        className="flex gap-2 rounded-xl bg-card/60 px-3 py-2 text-[12px] text-foreground/75 backdrop-blur"
                      >
                        <Quote className="mt-0.5 h-3 w-3 shrink-0 text-coral" />
                        <span className="line-clamp-2">
                          {s.location && (
                            <span className="mr-1 font-medium text-coral">{s.location}</span>
                          )}
                          {s.content}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
