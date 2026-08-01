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
  const [thirdPartyBlocked, setThirdPartyBlocked] = useState<boolean | null>(null);
  const [lastError, setLastError] = useState<{ reason: string; raw?: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Sanitize `next` to same-origin relative path only.
  const nextPath =
    search.next && search.next.startsWith("/") && !search.next.startsWith("//")
      ? search.next
      : "/library";

  useEffect(() => {
    let iframed = false;
    try {
      iframed = window.self !== window.top;
    } catch {
      iframed = true;
    }
    setInIframe(iframed);
    try {
      setCookiesEnabled(navigator.cookieEnabled);
    } catch {
      setCookiesEnabled(null);
    }
    // Third-party / cross-site cookie access probe.
    void detectThirdPartyCookiesBlocked(iframed).then(setThirdPartyBlocked);
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
    try {
      sessionStorage.setItem("ember:next", nextPath);
    } catch {
      /* ignore */
    }

    // If third-party cookies are blocked (or we're iframed with unknown status),
    // popup OAuth cannot complete — the Google window can't set the session
    // cookie back into this origin. Break out to a top-level tab instead.
    if (thirdPartyBlocked === true || (inIframe && thirdPartyBlocked !== false)) {
      openInNewTab();
      setLastError({
        reason: "cookies_disabled",
        raw: "Third-party cookies are restricted. Opened sign-in in a new tab.",
      });
      setShowDebug(true);
      toast.info("Opening sign-in in a new tab", {
        description: "Your browser blocks cross-site cookies inside this preview.",
      });
      setBusy(false);
      return;
    }

    checkPopupBlocker();
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      const msg = result.error.message ?? "Sign in was cancelled.";
      const reason = diagnoseError(msg);
      setLastError({ reason, raw: msg });
      setShowDebug(true);
      // Auto-recover on cookie/popup errors by opening in a new tab.
      if (reason === "cookies_disabled" || reason === "popup_blocked") {
        toast.error("Switching to new-tab sign-in", { description: msg });
        openInNewTab();
      } else {
        toast.error("Google sign in failed", { description: msg });
      }
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
        toast.success("Welcome to Ember", { description: "Check your inbox to confirm your email." });
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
              <div className="font-display text-lg font-semibold leading-none">Ember</div>
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




          {thirdPartyBlocked && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-coral/30 bg-rose/20 p-3 text-xs">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              <div>
                <div className="font-medium text-foreground">Cross-site cookies are blocked</div>
                <div className="mt-0.5 text-muted-foreground">
                  Google sign-in can't complete inside this preview. We'll open it in a new tab, or you can sign in with email below.
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleGoogle}
            disabled={busy}
            variant="outline"
            className="mt-4 w-full rounded-full border-white/70 bg-white/70 py-6 backdrop-blur"
          >
            <GoogleIcon />
            {thirdPartyBlocked
              ? "Continue with Google (new tab)"
              : "Continue with Google"}
          </Button>

          <button
            type="button"
            onClick={openInNewTab}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {inIframe ? "Google sign-in not working? Open in a new tab" : "Open this page in a new tab"}
          </button>

          <SignInDebugPanel
            open={showDebug}
            onToggle={() => setShowDebug((v) => !v)}
            inIframe={inIframe}
            cookiesEnabled={cookiesEnabled}
            popupBlocked={popupBlocked}
            thirdPartyBlocked={thirdPartyBlocked}
            lastError={lastError}
            onOpenInNewTab={openInNewTab}
            onRecheck={async () => {
              checkPopupBlocker();
              try { setCookiesEnabled(navigator.cookieEnabled); } catch { /* noop */ }
              setThirdPartyBlocked(await detectThirdPartyCookiesBlocked(inIframe));
            }}
          />



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
            {mode === "signup" ? "Already have an account? " : "New to Ember? "}
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

type Check = { label: string; ok: boolean | null; hint?: string };

const REASONS: Record<string, { title: string; fixes: string[] }> = {
  user_cancelled: {
    title: "The Google window was closed before you finished signing in.",
    fixes: [
      "Click 'Continue with Google' again and pick your account.",
      "If a popup opened and closed instantly, your browser may be blocking it — use 'Open in new tab' below.",
    ],
  },
  popup_blocked: {
    title: "Your browser blocked the Google sign-in popup.",
    fixes: [
      "Allow popups for this site in your browser's address bar.",
      "Or click 'Open in a new tab' below to sign in without a popup.",
    ],
  },
  cookies_disabled: {
    title: "Third-party cookies are disabled.",
    fixes: [
      "Enable cookies (especially third-party) for accounts.google.com.",
      "In Safari: Settings → Privacy → uncheck 'Prevent cross-site tracking'.",
      "In Chrome: Settings → Privacy and security → Cookies → allow third-party cookies.",
    ],
  },
  network: {
    title: "The sign-in request couldn't reach Google.",
    fixes: [
      "Check your internet connection and try again.",
      "Disable VPNs, ad-blockers, or strict privacy extensions temporarily.",
    ],
  },
  redirect_uri: {
    title: "The redirect URL wasn't accepted.",
    fixes: [
      "Open this page in a new tab and retry — the preview iframe origin can differ.",
    ],
  },
  unknown: {
    title: "Google sign-in didn't complete.",
    fixes: [
      "Try again, or use 'Open in a new tab' below.",
      "If it keeps failing, sign in with email and password.",
    ],
  },
};

function SignInDebugPanel(props: {
  open: boolean;
  onToggle: () => void;
  inIframe: boolean;
  cookiesEnabled: boolean | null;
  popupBlocked: boolean | null;
  thirdPartyBlocked: boolean | null;
  lastError: { reason: string; raw?: string } | null;
  onOpenInNewTab: () => void;
  onRecheck: () => void;
}) {
  const {
    open, onToggle, inIframe, cookiesEnabled, popupBlocked,
    thirdPartyBlocked, lastError, onOpenInNewTab, onRecheck,
  } = props;
  const info = lastError ? REASONS[lastError.reason] ?? REASONS.unknown : null;

  const checks: Check[] = [
    { label: "Not inside an embedded frame", ok: !inIframe, hint: inIframe ? "Preview runs in an iframe — open in a new tab for reliable OAuth." : undefined },
    { label: "Cookies enabled", ok: cookiesEnabled, hint: cookiesEnabled === false ? "Enable cookies in your browser settings." : undefined },
    { label: "Cross-site cookies allowed", ok: thirdPartyBlocked === null ? null : !thirdPartyBlocked, hint: thirdPartyBlocked ? "Third-party cookies blocked — using new-tab fallback." : undefined },
    { label: "Popups allowed", ok: popupBlocked === null ? null : !popupBlocked, hint: popupBlocked ? "Allow popups for this site." : undefined },
  ];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
        {open ? "Hide sign-in diagnostics" : "Having trouble? Show sign-in diagnostics"}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-2xl border border-white/60 bg-white/60 p-4 text-sm backdrop-blur animate-float-in">
          {info && (
            <div className="rounded-xl bg-rose/20 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <div>
                  <div className="font-medium text-foreground">{info.title}</div>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {info.fixes.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</div>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-xs">
                  {c.ok === true && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
                  {c.ok === false && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />}
                  {c.ok === null && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div>
                    <div className="text-foreground">{c.label}</div>
                    {c.hint && <div className="text-muted-foreground">{c.hint}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onRecheck} className="rounded-full text-xs">
              Re-run checks
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onOpenInNewTab} className="rounded-full text-xs">
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open in new tab
            </Button>
          </div>

          {lastError?.raw && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Technical details</summary>
              <pre className="mt-1.5 overflow-x-auto rounded-lg bg-white/70 p-2 text-[11px]">{lastError.raw}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}



/**
 * Probe whether third-party / cross-site cookies are blocked.
 * Uses Storage Access API when available, then falls back to a document.cookie probe.
 * Returns true when blocked, false when allowed, null when unknown.
 */
async function detectThirdPartyCookiesBlocked(iframed: boolean): Promise<boolean | null> {
  try {
    // Storage Access API is the most accurate signal in iframes (Safari/Firefox/Chrome).
    // hasStorageAccess() returns false when cross-site cookies are partitioned/blocked.
    const doc = document as Document & { hasStorageAccess?: () => Promise<boolean> };
    if (iframed && typeof doc.hasStorageAccess === "function") {
      try {
        const has = await doc.hasStorageAccess();
        if (!has) return true;
      } catch {
        /* fall through to cookie probe */
      }
    }
    // Cookie write/read probe as a general fallback.
    const probe = "lumen_cookie_probe";
    document.cookie = `${probe}=1; SameSite=None; Secure; Path=/`;
    const canWrite = document.cookie.includes(`${probe}=1`);
    // Best-effort cleanup.
    document.cookie = `${probe}=; Max-Age=0; SameSite=None; Secure; Path=/`;
    if (!canWrite) return true;
    // Cookies work first-party; if iframed we can't be 100% sure about cross-site,
    // but if the write succeeded assume allowed.
    return false;
  } catch {
    return null;
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.94 0 3.24.83 3.98 1.54l2.72-2.62A9.99 9.99 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.05 9.6-9.76 0-.66-.07-1.16-.16-1.66H12z" />
    </svg>
  );
}
