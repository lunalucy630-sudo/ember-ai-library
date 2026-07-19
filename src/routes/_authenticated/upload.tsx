import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  analyzeItem,
  createItemFromLink,
  createNote,
  registerUploadedItem,
} from "@/lib/library.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload as UploadIcon, Link as LinkIcon, StickyNote, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/upload")({
  component: UploadPage,
});

function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Add to your library</h1>
        <p className="mt-2 text-muted-foreground">
          Upload a file, paste a link, or capture a quick note. Lumen will do the rest.
        </p>
      </header>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-3 rounded-2xl bg-white/70 p-1.5 backdrop-blur">
          <TabsTrigger value="upload" className="rounded-xl py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral data-[state=active]:to-rose data-[state=active]:text-primary-foreground">
            <UploadIcon className="mr-2 h-4 w-4" /> Upload
          </TabsTrigger>
          <TabsTrigger value="link" className="rounded-xl py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral data-[state=active]:to-rose data-[state=active]:text-primary-foreground">
            <LinkIcon className="mr-2 h-4 w-4" /> Paste link
          </TabsTrigger>
          <TabsTrigger value="note" className="rounded-xl py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-coral data-[state=active]:to-rose data-[state=active]:text-primary-foreground">
            <StickyNote className="mr-2 h-4 w-4" /> Note
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload"><UploadForm /></TabsContent>
        <TabsContent value="link"><LinkForm /></TabsContent>
        <TabsContent value="note"><NoteForm /></TabsContent>
      </Tabs>
    </div>
  );
}

function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;

      setProgress(20);
      const { error: upErr } = await supabase.storage
        .from("library")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      setProgress(60);

      const item = await registerUploadedItem({
        data: {
          title: title || file.name,
          storagePath: path,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
        },
      });
      setProgress(80);
      qc.invalidateQueries({ queryKey: ["items"] });

      // Fire and forget analysis
      analyzeItem({ data: { id: item.id } })
        .then(() => qc.invalidateQueries({ queryKey: ["items"] }))
        .catch((e) => toast.error("Analysis failed", { description: e instanceof Error ? e.message : "" }));

      setProgress(100);
      toast.success("Added to your library", { description: "Lumen is understanding it now." });
      navigate({ to: "/item/$id", params: { id: item.id } });
    } catch (e) {
      toast.error("Upload failed", { description: e instanceof Error ? e.message : "" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-3xl p-6">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-rose/50 bg-white/40 px-6 py-14 text-center transition-colors hover:bg-white/60"
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-coral to-rose text-primary-foreground shadow-[var(--shadow-glow)]">
          <UploadIcon className="h-6 w-6" />
        </div>
        <div className="mt-4 font-display text-lg font-semibold">
          {file ? file.name : "Drop a file, or click to browse"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          MP4, MOV, MP3, PDF, DOCX, PPTX, PNG — up to your storage plan
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
          }}
        />
      </div>

      <div className="mt-5 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give it a lovely name"
            className="rounded-xl bg-white/80"
          />
        </div>
        {busy && (
          <div className="h-2 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-coral to-rose transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <Button
          onClick={handleUpload}
          disabled={!file || busy}
          className="w-full rounded-full bg-gradient-to-r from-coral to-rose py-6 text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : <>Add to library</>}
        </Button>
      </div>
    </div>
  );
}

function LinkForm() {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const item = await createItemFromLink({ data: { url, title: title || undefined } });
      analyzeItem({ data: { id: item.id } })
        .then(() => qc.invalidateQueries({ queryKey: ["items"] }))
        .catch(() => {});
      return item;
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Saved", { description: "Lumen is analyzing the link." });
      navigate({ to: "/item/$id", params: { id: item.id } });
    },
    onError: (e) => toast.error("Could not save", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <div className="glass rounded-3xl p-6">
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-coral" /> Works with YouTube, TikTok, Instagram, and any web link.
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="rounded-xl bg-white/80"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ltitle">Title (optional)</Label>
          <Input
            id="ltitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Autofills if left empty"
            className="rounded-xl bg-white/80"
          />
        </div>
        <Button
          onClick={() => url && mut.mutate()}
          disabled={!url || mut.isPending}
          className="w-full rounded-full bg-gradient-to-r from-coral to-rose py-6 text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          {mut.isPending ? "Saving…" : "Save to library"}
        </Button>
      </div>
    </div>
  );
}

function NoteForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const item = await createNote({ data: { title, content } });
      analyzeItem({ data: { id: item.id } })
        .then(() => qc.invalidateQueries({ queryKey: ["items"] }))
        .catch(() => {});
      return item;
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Note added");
      navigate({ to: "/item/$id", params: { id: item.id } });
    },
    onError: (e) => toast.error("Could not save", { description: e instanceof Error ? e.message : "" }),
  });

  return (
    <div className="glass rounded-3xl p-6">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ntitle">Title</Label>
          <Input
            id="ntitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A thought worth remembering"
            className="rounded-xl bg-white/80"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ncontent">Note</Label>
          <Textarea
            id="ncontent"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type freely — Lumen will summarize and tag it."
            className="min-h-[180px] rounded-2xl bg-white/80"
          />
        </div>
        <Button
          onClick={() => title && content && mut.mutate()}
          disabled={!title || !content || mut.isPending}
          className="w-full rounded-full bg-gradient-to-r from-coral to-rose py-6 text-primary-foreground shadow-[var(--shadow-soft)]"
        >
          {mut.isPending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </div>
  );
}
