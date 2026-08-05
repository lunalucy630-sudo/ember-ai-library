import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Loader2, FolderPlus, FolderInput, Merge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyOrganize, proposeOrganize, type OrganizeAction } from "@/lib/organize.functions";

export function AutoOrganizeButton() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [actions, setActions] = useState<OrganizeAction[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());

  const propose = useMutation({
    mutationFn: (force: boolean) => proposeOrganize({ data: { force } }),
    onSuccess: (plan) => {
      setRunId(plan.runId);
      setActions(plan.actions);
      setAccepted(new Set(plan.actions.map((_, i) => i)));
      setOpen(true);
      if (plan.actions.length === 0) toast.success(t("organize.nothingToDo"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: () =>
      applyOrganize({ data: { runId: runId!, acceptedIndexes: Array.from(accepted) } }),
    onSuccess: (r) => {
      toast.success(t("organize.applied", { count: r.applied }));
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (i: number) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <>
      <Button
        variant="outline"
        className="rounded-full bg-card/70 px-5"
        disabled={propose.isPending}
        onClick={() => propose.mutate(false)}
      >
        {propose.isPending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-1.5 h-4 w-4" />
        )}
        {t("organize.button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{t("organize.reviewTitle")}</DialogTitle>
            <DialogDescription>{t("organize.reviewSub")}</DialogDescription>
          </DialogHeader>

          {actions.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">{t("organize.nothingToDo")}</p>
          ) : (
            <div className="space-y-2">
              {actions.map((a, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl bg-card/70 p-4 transition hover:shadow-[var(--shadow-soft)]"
                >
                  <Checkbox checked={accepted.has(i)} onCheckedChange={() => toggle(i)} className="mt-1" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {a.type === "create" ? (
                        <>
                          <FolderPlus className="h-4 w-4 text-coral" />
                          {t("organize.createLabel", { name: a.name })}
                        </>
                      ) : a.type === "add" ? (
                        <>
                          <FolderInput className="h-4 w-4 text-coral" />
                          {t("organize.addLabel", { item: a.itemTitle, collection: a.collectionName })}
                        </>
                      ) : (
                        <>
                          <Merge className="h-4 w-4 text-coral" />
                          {t("organize.mergeLabel", { from: a.fromName, into: a.intoName })}
                        </>
                      )}
                    </div>
                    {a.type === "create" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.description} · {a.itemTitles.slice(0, 4).join(", ")}
                        {a.itemTitles.length > 4 ? ` +${a.itemTitles.length - 4}` : ""}
                      </p>
                    )}
                    {a.reason && <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              className="rounded-full text-xs"
              disabled={propose.isPending}
              onClick={() => propose.mutate(true)}
            >
              {t("organize.fullReindex")}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
                {t("organize.dismiss")}
              </Button>
              <Button
                className="rounded-full bg-gradient-to-r from-coral to-rose px-5 text-primary-foreground"
                disabled={accepted.size === 0 || apply.isPending || !runId}
                onClick={() => apply.mutate()}
              >
                {apply.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                {t("organize.applySelected", { count: accepted.size })}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
