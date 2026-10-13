import { Suspense, lazy } from "react";
import { List } from "@/components/ui/list";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useListDatasets } from "../api/dataset-api";
import { DeleteDatasetDialog } from "./delete-dataset-dialog";
const DatasetSheet = lazy(() => import("./dataset-sheet/dataset-sheet"));

interface DatasetActionsProps {
  organizationId: string;
}

export default function DatasetOverview({
  organizationId,
}: DatasetActionsProps) {
  const { data: datasets, isPending, error, refetch } = useListDatasets(organizationId);
  const navigate = useNavigate();

  return (
    <div className="w-full flex justify-center">
      <div className="w-full max-w-6xl mx-auto">
        <List>
          <List.Header title="Datasets">
            <Suspense fallback={<Button variant="outline" size="sm" disabled>Create</Button>}>
              <DatasetSheet organizationId={organizationId} />
            </Suspense>
          </List.Header>
          <div>
            {isPending && <p className="p-4 text-sm text-muted-foreground">Loading datasets…</p>}
            {error && (
              <div className="flex items-center gap-2 p-4" role="alert">
                <p className="text-sm">{error.message}</p>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
              </div>
            )}
            {!isPending && !error && datasets?.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No datasets yet. Create one to start collecting logs.</p>
            )}
            {datasets &&
              datasets.map((dataset) => (
                <List.Item
                  key={dataset.id}
                  title={dataset.name}
                  subtitle={dataset.description}
                  onClick={() => navigate(dataset.id)}
                  rightContent={<DeleteDatasetDialog organizationId={organizationId} dataset={dataset} />}
                />
              ))}
          </div>
        </List>
      </div>
    </div>
  );
}
