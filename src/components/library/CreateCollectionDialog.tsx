import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createCollection } from "@/lib/library.functions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function CreateCollectionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      createCollection({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success(t("collections.created"));
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(t("collections.createFailed"), {
        description: e instanceof Error ? e.message : t("common.tryAgain"),
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-white/60 bg-card/90 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("collections.new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cname">{t("collections.name")}</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("collections.namePh")}
              className="rounded-xl bg-card/80"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdesc">{t("collections.descOptional")}</Label>
            <Input
              id="cdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("collections.descPh")}
              className="rounded-xl bg-card/80"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => name.trim() && mut.mutate({ name: name.trim(), description: description.trim() || undefined })}
            disabled={!name.trim() || mut.isPending}
            className="rounded-full bg-gradient-to-r from-coral to-rose text-primary-foreground"
          >
            {mut.isPending ? t("collections.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
