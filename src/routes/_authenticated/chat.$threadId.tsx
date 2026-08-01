import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getThread, sendChatMessage } from "@/lib/chat.functions";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-thread", threadId],
    queryFn: () => getThread({ data: { id: threadId } }),
  });

  const send = useMutation({
    mutationFn: (content: string) => sendChatMessage({ data: { threadId, content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-thread", threadId] });
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages.length, send.isPending]);

  const handleSend = () => {
    const t = input.trim();
    if (!t || send.isPending) return;
    setInput("");
    send.mutate(t);
  };

  return (
    <div className="glass flex h-[calc(100vh-8rem)] flex-col rounded-3xl">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : data?.messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div className="max-w-md">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-display text-xl">Ask about anything you've saved</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Ember only uses your library. It'll cite the items it references.
              </p>
            </div>
          </div>
        ) : (
          data?.messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                m.role === "user"
                  ? "bg-white/70 text-foreground"
                  : "bg-gradient-to-br from-coral to-rose text-primary-foreground"
              }`}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-gradient-to-r from-coral/25 to-rose/20 text-foreground"
                  : "bg-white/80 text-foreground/90"
              }`}>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{stripCitations(m.content)}</ReactMarkdown>
                </div>
                {m.cited_item_ids && m.cited_item_ids.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/40 pt-2">
                    {m.cited_item_ids.map((id) => (
                      <Link
                        key={id}
                        to="/item/$id"
                        params={{ id }}
                        className="rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] text-foreground/80 hover:bg-white"
                      >
                        cited item
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {send.isPending && (
          <div className="flex gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-coral to-rose text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="rounded-3xl bg-white/80 px-4 py-3 text-sm text-foreground/70">
              <span className="inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> thinking…</span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="border-t border-border/50 p-4"
      >
        <div className="flex items-end gap-2 rounded-2xl bg-white/80 p-2 backdrop-blur">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Ask Ember about your library…"
            className="min-h-[46px] max-h-40 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
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

function stripCitations(text: string): string {
  return text.replace(/\[cited:[^\]]*\]/gi, "").trim();
}
