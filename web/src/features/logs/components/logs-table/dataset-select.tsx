import { useNavigate, useParams } from "react-router";
import { useListDatasets } from "../../api/dataset-api";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { DeleteDatasetDialog } from "../delete-dataset-dialog";

interface DatasetSelectProps {
  teamId: string;
}

export function DatasetSelect({ teamId }: DatasetSelectProps) {
  const params = useParams<{ organizationId: string; datasetId: string }>();
  const navigate = useNavigate();

  const { data: datasets } = useListDatasets(params.organizationId);

  const currentDataset = datasets?.find((d) => d.id === params.datasetId);


  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentDataset?.id ?? ""}
        onValueChange={(value) => navigate(`/logs/${teamId}/${value}`)}
      >
        <SelectTrigger className="min-w-[180px] text-xs">
          <SelectValue placeholder="Select a dataset" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {datasets?.map((dataset) => (
              <SelectItem key={dataset.id} value={dataset.id} className="text-xs">
                {dataset.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {currentDataset && (
        <DeleteDatasetDialog organizationId={teamId} dataset={currentDataset} />
      )}
    </div>
  );
}
