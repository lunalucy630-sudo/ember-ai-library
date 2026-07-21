import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ArrowLeft, ExternalLink, Info, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const [cookiesEnabled, setCookiesEnabled] = useState<boolean | null>(null);
  const [popupBlocked, setPopupBlocked] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<{ reason: string; raw?: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Sanitize `next` to same-origin relative path only.
  const nextPath =
    search.next && search.next.startsWith("/") && !search.next.startsWith("//")
      ? search.next
      : "/library";

  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }
    try {
      setCookiesEnabled(navigator.cookieEnabled);
    } catch {
      setCookiesEnabled(null);
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: nextPath });
    });
  }, [navigate, nextPath]);

  const checkPopupBlocker = () => {
    try {
      const test = window.open("", "_blank", "width=100,height=100");
      if (!test || test.closed || typeof test.closed === "undefined") {
        setPopupBlocked(true);
        return true;
      }
      test.close();
      setPopupBlocked(false);
      return false;
    } catch {
      setPopupBlocked(true);
      return true;
    }
  };

  const diagnoseError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (/popup.*block|blocked.*popup/.test(m)) return "popup_blocked";
    if (/cancel|closed|user.*denied|dismiss/.test(m)) return "user_cancelled";
    if (/cookie/.test(m)) return "cookies_disabled";
    if (/network|fetch|timeout/.test(m)) return "network";
    if (/redirect|origin|domain/.test(m)) return "redirect_uri";
    return "unknown";
  };

  const openInNewTab = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("next", nextPath);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const handleGoogle = async () => {
    setBusy(true);
    // Persist the intended destination so the post-OAuth landing can honor it.
    try {
      sessionStorage.setItem("lumen:next", nextPath);
    } catch {
      /* ignore */
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      const msg = result.error.message ?? "";
      const looksBlocked = /cancel|popup|blocked|closed/i.test(msg);
      toast.error("Google sign in failed", {
        description: looksBlocked
          ? "The Google window was closed or blocked. Try 'Open in new tab' below."
          : msg,
      });
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: nextPath });
  };


  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(nextPath)}`,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Welcome to Lumen", { description: "Check your inbox to confirm your email." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: nextPath });
      }
    } catch (err) {
      toast.error(mode === "signup" ? "Sign up failed" : "Sign in failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-rose/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-powder/70 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="glass rounded-3xl p-8 animate-float-in">
          <div className="mb-6 flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold leading-none">Lumen</div>
              <div className="text-xs text-muted-foreground">Your AI video library</div>
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your library" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "A cozy place for everything you want to remember."
              : "Sign in to open your library."}
          </p>

          <Button
            onClick={handleGoogle}
            disabled={busy}
            variant="outline"
            className="mt-6 w-full rounded-full border-white/70 bg-white/70 py-6 backdrop-blur"
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <button
            type="button"
            onClick={openInNewTab}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {inIframe ? "Google sign-in not working? Open in a new tab" : "Open this page in a new tab"}
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-xl bg-white/70"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="rounded-xl bg-white/70"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl bg-white/70"
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-coral to-rose py-6 text-primary-foreground shadow-[var(--shadow-soft)] hover:opacity-95"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New to Lumen? "}
            <button
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.94 0 3.24.83 3.98 1.54l2.72-2.62A9.99 9.99 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.05 9.6-9.76 0-.66-.07-1.16-.16-1.66H12z" />
    </svg>
  );
}
