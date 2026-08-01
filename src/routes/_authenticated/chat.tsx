import { useTranslation } from "react-i18next";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createThread, deleteThread, listThreads } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { MessagesSquare, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const state = useRouterState();
  const activeId = state.matches.find((m) => m.params && "threadId" in m.params)?.params.threadId as string | undefined;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: threads = [] } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => listThreads(),
  });

  const create = useMutation({
    mutationFn: () => createThread(),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteThread({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (activeId === id) navigate({ to: "/chat" });
    },
  });

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
      <aside className="glass h-[calc(100vh-8rem)] rounded-3xl p-4">
        <Button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="w-full rounded-full bg-gradient-to-r from-coral to-rose text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          <Plus className="mr-1.5 h-4 w-4" /> {t("chat.newChat")}
        </Button>
        <div className="mt-4 space-y-1 overflow-y-auto">
          {threads.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">{t("chat.empty")}</p>
          )}
          {threads.map((th) => (
            <div
              key={th.id}
              className={`group flex items-center gap-1 rounded-xl px-1 ${
                activeId === th.id ? "bg-gradient-to-r from-coral/20 to-rose/15" : "hover:bg-white/60"
              }`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: th.id }}
                className="flex-1 truncate rounded-xl px-2 py-2 text-sm"
              >
                {th.title || t("chat.newChat")}
              </Link>
              <button
                onClick={() => confirm(t("chat.deletePrompt")) && del.mutate(th.id)}
                className="opacity-0 rounded-lg p-1.5 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0">
        {activeId ? (
          <Outlet />
        ) : (
          <div className="glass grid h-[calc(100vh-8rem)] place-items-center rounded-3xl p-8 text-center">
            <div className="max-w-md">
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
                <MessagesSquare className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold">{t("chat.askEmber")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("chat.promptExamples")}
              </p>
              <Button
                onClick={() => create.mutate()}
                className="mt-6 rounded-full bg-gradient-to-r from-coral to-rose px-6 py-5 text-primary-foreground shadow-[var(--shadow-soft)]"
              >
                <Plus className="mr-1.5 h-4 w-4" /> {t("chat.start")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
