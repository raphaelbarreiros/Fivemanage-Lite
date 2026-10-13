import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/features/organizations/api/useCurrentOrganization";
import { Dataset } from "@/typings/dataset";
import { useDeleteDataset } from "../api/dataset-api";

interface DeleteDatasetDialogProps {
  organizationId: string;
  dataset: Dataset;
}

export function DeleteDatasetDialog({ organizationId, dataset }: DeleteDatasetDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const submitting = useRef(false);
  const { data: organization } = useCurrentOrganization(organizationId);
  const { mutateAsync, isPending } = useDeleteDataset(organizationId);
  const navigate = useNavigate();

  if (organization?.role !== "ADMIN") {
    return null;
  }

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || confirmation !== dataset.name) return;
    submitting.current = true;
    try {
      await mutateAsync(dataset.id);
      setOpen(false);
      setConfirmation("");
      toast.success(`Dataset "${dataset.name}" deleted`);
      navigate(`/app/${organizationId}/logs`, { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete dataset");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (submitting.current) return;
          setOpen(nextOpen);
          setConfirmation("");
        }}
      >
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm" aria-label={`Delete dataset ${dataset.name}`}>
            Delete dataset
          </Button>
        </DialogTrigger>
        <DialogContent showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>Delete dataset "{dataset.name}"?</DialogTitle>
            <DialogDescription>
              This permanently removes the dataset, all its logs and traces, and
              its searchable fields. This cannot be undone. Organization API tokens
              remain active for other datasets; ingestion into this dataset will
              fail until a dataset with this name is created again. Deleting the
              default dataset also stops log ingestion that omits a dataset name.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDelete} className="flex flex-col gap-4">
            <Label htmlFor={`delete-dataset-${dataset.id}`}>
              Type {dataset.name} to confirm
            </Label>
            <Input
              id={`delete-dataset-${dataset.id}`}
              autoComplete="off"
              value={confirmation}
              disabled={isPending}
              onChange={(event) => setConfirmation(event.target.value)}
            />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending || confirmation !== dataset.name}>
                {isPending ? "Deleting…" : "Permanently delete dataset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
