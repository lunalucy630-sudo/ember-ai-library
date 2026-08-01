import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { searchLibrary, type LibraryItem } from "@/lib/library.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

function SearchPage() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LibraryItem[] | null>(null);

  const mut = useMutation({
    mutationFn: () => searchLibrary({ data: { query: q } }),
    onSuccess: (r) => setResults(r),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{t("search.title")}</h1>
        <p className="mt-2 text-muted-foreground">
          {t("search.sub")}
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) mut.mutate();
        }}
        className="glass flex items-center gap-2 rounded-full p-2"
      >
        <div className="pl-3 text-muted-foreground"><Search className="h-4 w-4" /></div>
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
            {results.map((r) => (
              <Link
                key={r.id}
                to="/item/$id"
                params={{ id: r.id }}
                className="glass block rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]"
              >
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {r.kind} · {r.source}
                </div>
                <div className="mt-1 font-display text-lg font-semibold">{r.title}</div>
                {r.summary_short && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.summary_short}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
