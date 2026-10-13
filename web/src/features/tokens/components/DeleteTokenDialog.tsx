import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash } from "lucide-react";
import { useDeleteToken } from "../api/useDeleteToken";
import { useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/typings/query";
import { useState } from "react";
import { toast } from "sonner";

interface DeleteTokenDialogProps {
  tokenId: number;
}

export function DeleteTokenDialog(props: DeleteTokenDialogProps) {
  const { tokenId } = props;

  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useDeleteToken();

  async function handleDelete() {
    if (isPending) return;
    try {
      await mutateAsync(tokenId);
      setOpen(false);
      toast.success("Token deleted");
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.Tokens] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete token");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete token"
          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Token</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this token? This action cannot be
            undone and any applications using this token will lose access.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Delete Token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
