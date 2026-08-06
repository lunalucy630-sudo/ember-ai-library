import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Flame, Send, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { createThread, getThread, listThreads, sendChatMessage } from "@/lib/chat.functions";

interface Props {
  collectionId?: string;
  itemId?: string;
  titleById?: Record<string, string>;
  suggestions?: string[];
  className?: string;
}

export function ScopedChatPanel({ collectionId, itemId, titleById = {}, suggestions = [], className }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scopeKey = collectionId ?? itemId ?? "library";

  const { data: threads } = useQuery({
    queryKey: ["scoped-threads", scopeKey],
    queryFn: () => listThreads({ data: { collectionId: collectionId ?? null } }),
    enabled: Boolean(collectionId),
  });

  useEffect(() => {
    setThreadId(null);
  }, [scopeKey]);

  useEffect(() => {
    if (!threadId && threads && threads.length > 0) setThreadId(threads[0]!.id);
  }, [threads, threadId]);

  const { data } = useQuery({
    queryKey: ["chat-thread", threadId],
    queryFn: () => getThread({ data: { id: threadId! } }),
    enabled: Boolean(threadId),
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      let id = threadId;
      if (!id) {
        const thread = await createThread({ data: { collectionId: collectionId ?? null } });
        id = thread.id;
        setThreadId(id);
      }
      return sendChatMessage({ data: { threadId: id, content, collectionId: collectionId ?? null, itemId: itemId ?? null } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
      qc.invalidateQueries({ queryKey: ["scoped-threads", scopeKey] });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages.length, send.isPending]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [scopeKey]);

  const messages = useMemo(() => data?.messages ?? [], [data]);

  const submit = (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || send.isPending) return;
    setInput("");
    send.mutate(text);
  };

  return (
    <div className={`glass flex flex-col rounded-3xl ${className ?? ""}`}>
      <div className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-coral to-rose text-primary-foreground">
          <Flame className="h-4 w-4" />
        </div>
        <div>
          <div className="font-display text-sm font-semibold">{t("collectionChat.title")}</div>
          <div className="text-[11px] text-muted-foreground">{t("collectionChat.scopeHint")}</div>
        </div>
        {threadId && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto rounded-full text-xs"
            onClick={() => setThreadId(null)}
          >
            {t("collectionChat.newChat")}
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && !send.isPending ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("collectionChat.empty")}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-full bg-card/70 px-3 py-1.5 text-left text-xs text-foreground/80 transition hover:shadow-[var(--shadow-soft)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                  m.role === "user"
                    ? "bg-card/70 text-foreground"
                    : "bg-gradient-to-br from-coral to-rose text-primary-foreground"
                }`}
              >
                {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Flame className="h-3.5 w-3.5" />}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-gradient-to-r from-coral/25 to-rose/20 text-foreground"
                    : "bg-card/80 text-foreground/90"
                }`}
              >
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{m.content.replace(/\[cited:[^\]]*\]/gi, "").trim()}</ReactMarkdown>
                </div>
                {(() => {
                  const cites = parseCitations(m.content, m.cited_item_ids ?? []);
                  if (cites.length === 0) return null;
                  return (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/50 pt-2">
                      {cites.map((c) => (
                        <Link
                          key={`${c.id}-${c.locator ?? ""}`}
                          to="/item/$id"
                          params={{ id: c.id }}
                          search={
                            c.seconds != null
                              ? { t: c.seconds }
                              : c.locator
                                ? { s: c.locator }
                                : {}
                          }
                          className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2.5 py-0.5 text-[11px] text-foreground/80 hover:shadow-[var(--shadow-soft)]"
                        >
                          {c.seconds != null ? (
                            <Play className="h-2.5 w-2.5" />
                          ) : c.locator ? (
                            <FileText className="h-2.5 w-2.5" />
                          ) : null}
                          <span>{titleById[c.id] ?? t("collectionChat.source")}</span>
                          {c.locator && (
                            <span className="font-mono text-[10px] text-muted-foreground">{c.locator}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  );
                })()}

              </div>
            </div>
          ))
        )}
        {send.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("collectionChat.thinking")}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="border-t border-border/50 p-3"
      >
        <div className="flex items-end gap-2 rounded-2xl bg-card/80 p-2 backdrop-blur">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t("collectionChat.placeholder")}
            className="min-h-[42px] max-h-32 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={!input.trim() || send.isPending}
            className="rounded-full bg-gradient-to-r from-coral to-rose px-4 text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
