import { useState } from "react";
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: (input: { name: string; description?: string }) =>
      createCollection({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      toast.success("Collection created");
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error("Could not create collection", {
        description: e instanceof Error ? e.message : "Try again.",
      }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-white/60 bg-white/90 backdrop-blur-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Name</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Recipes, Leadership, University"
              className="rounded-xl bg-white/80"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cdesc">Description (optional)</Label>
            <Input
              id="cdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A quiet corner of your library"
              className="rounded-xl bg-white/80"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => name.trim() && mut.mutate({ name: name.trim(), description: description.trim() || undefined })}
            disabled={!name.trim() || mut.isPending}
            className="rounded-full bg-gradient-to-r from-coral to-rose text-primary-foreground"
          >
            {mut.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
