import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Video, BookOpen, MessagesSquare, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        let next = "/library";
        try {
          const stored = sessionStorage.getItem("ember:next");
          if (stored && stored.startsWith("/") && !stored.startsWith("//")) next = stored;
          sessionStorage.removeItem("ember:next");
        } catch {
          /* ignore */
        }
        navigate({ to: next });
      } else setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-coral/60" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-rose/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-powder/70 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Ember</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost" className="rounded-full">Sign in</Button>
          </Link>
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button className="rounded-full bg-gradient-to-r from-coral to-rose text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-95">
              Start your library
            </Button>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-32 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-4 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-coral" /> AI-powered knowledge library
        </div>
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-7xl">
          Every video you save,{" "}
          <span className="text-gradient">understood</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Ember is your personal digital library. Save videos, lectures, recipes, PDFs, and notes —
          and let AI watch, read, and remember everything for you.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" }}>
            <Button size="lg" className="rounded-full bg-gradient-to-r from-coral to-rose px-8 py-6 text-base text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95">
              Create your library
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="lg" variant="outline" className="rounded-full border-white/70 bg-white/60 px-8 py-6 text-base backdrop-blur">
              Sign in
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Video, title: "Videos, first", body: "Upload MP4s or paste YouTube, TikTok & Reels links." },
            { icon: Sparkles, title: "AI watches", body: "Transcripts, key moments, summaries, and tags — automatic." },
            { icon: BookOpen, title: "Elegant library", body: "Collections instead of folders. One item, many places." },
            { icon: MessagesSquare, title: "Chat with it", body: "Ask questions across everything you've ever saved." },
          ].map((f, i) => (
            <div
              key={f.title}
              className="glass rounded-3xl p-6 text-left animate-float-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="font-display text-lg font-semibold">{f.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
