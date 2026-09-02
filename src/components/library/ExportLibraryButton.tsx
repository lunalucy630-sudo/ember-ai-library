import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2, FileJson, Archive } from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportLibrary } from "@/lib/export.functions";

type Phase = "idle" | "loading" | "files";

/** Download everything (metadata + files) as a portable bundle — no AI involved. */
export function ExportLibraryButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const toMarkdown = (data: Awaited<ReturnType<typeof exportLibrary>>) => {
    const byId = new Map(data.collections.map((c) => [String(c["id"]), String(c["name"])]));
    const colsFor = (itemId: string) =>
      data.itemCollections
        .filter((l) => l["item_id"] === itemId)
        .map((l) => byId.get(String(l["collection_id"])))
        .filter(Boolean)
        .join(", ");
    const lines = [`# Ember library export — ${data.exportedAt}`, ""];
    for (const it of data.items) {
      const id = String(it["id"]);
      lines.push(`## ${it["title"]}`);
      lines.push(`- Kind: ${it["kind"]} · Source: ${it["source"]}`);
      if (it["source_url"]) lines.push(`- URL: ${it["source_url"]}`);
      const cols = colsFor(id);
      if (cols) lines.push(`- Collections: ${cols}`);
      const tags = Array.isArray(it["tags"]) ? (it["tags"] as string[]) : [];
      if (tags.length) lines.push(`- Tags: ${tags.map((x) => `#${x}`).join(" ")}`);
      lines.push(`- Saved: ${it["created_at"]}`);
      if (it["description"]) lines.push("", String(it["description"]));
      if (it["summary_long"]) lines.push("", "### Summary", "", String(it["summary_long"]));
      else if (it["summary_short"]) lines.push("", "### Summary", "", String(it["summary_short"]));
      if (it["raw_content"]) lines.push("", "### Content", "", String(it["raw_content"]));
      if (it["transcript"]) lines.push("", "### Transcript", "", String(it["transcript"]));
      lines.push("");
    }
    return lines.join("\n");
  };

  const run = async (includeFiles: boolean) => {
    setPhase("loading");
    try {
      const data = await exportLibrary();
      const json = JSON.stringify(data, null, 2);
      const md = toMarkdown(data);

      if (!includeFiles || data.files.length === 0) {
        const zip = zipSync({
          "ember-export.json": strToU8(json),
          "ember-export.md": strToU8(md),
        });
        save(new Blob([zip], { type: "application/zip" }), `ember-export-${stamp()}.zip`);
        toast.success(t("export.done", { count: data.items.length }));
        return;
      }

      setPhase("files");
      setProgress({ done: 0, total: data.files.length });
      const entries: Record<string, Uint8Array> = {
        "ember-export.json": strToU8(json),
        "ember-export.md": strToU8(md),
      };
      let failed = 0;
      for (const f of data.files) {
        try {
          const res = await fetch(f.url);
          if (!res.ok) throw new Error(String(res.status));
          entries[`files/${f.fileName}`] = new Uint8Array(await res.arrayBuffer());
        } catch {
          failed++;
        }
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      const zip = zipSync(entries, { level: 0 });
      save(new Blob([zip], { type: "application/zip" }), `ember-export-full-${stamp()}.zip`);
      if (failed > 0) toast.warning(t("export.partial", { count: failed }));
      else toast.success(t("export.done", { count: data.items.length }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("export.failed"));
    } finally {
      setPhase("idle");
    }
  };

  const busy = phase !== "idle";

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => run(true)}
        className="w-full justify-start gap-2 rounded-2xl px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
        {phase === "files"
          ? t("export.progress", { done: progress.done, total: progress.total })
          : phase === "loading"
            ? t("export.preparing")
            : t("export.full")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => run(false)}
        className="w-full justify-start gap-2 rounded-2xl px-3 text-sm text-muted-foreground hover:text-foreground"
      >
        <FileJson className="h-4 w-4" />
        {t("export.dataOnly")}
      </Button>
      {!compact && (
        <p className="flex items-start gap-1.5 px-3 text-[11px] leading-snug text-muted-foreground/80">
          <Download className="mt-0.5 h-3 w-3 shrink-0" />
          {t("export.hint")}
        </p>
      )}
    </div>
  );
}
