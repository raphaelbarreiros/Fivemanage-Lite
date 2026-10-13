import { CreateDatasetSchema, Dataset } from "@/typings/dataset";
import { QueryKeys } from "@/typings/query";
import { fetchApi } from "@/utils/http-util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useListDatasets(organizationId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Datasets, organizationId],
    enabled: !!organizationId,
    queryFn: ({ signal }) =>
      fetchApi<Dataset[]>(`/api/dash/${organizationId}/dataset`, { signal }),
  });
}

export function useCreateDataset(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDatasetSchema) =>
      fetchApi<Dataset>(`/api/dash/${organizationId}/dataset`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: async (dataset) => {
      const queryKey = [QueryKeys.Datasets, organizationId];
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<Dataset[]>(queryKey, (datasets = []) => [
        ...datasets.filter((item) => item.id !== dataset.id),
        dataset,
      ]);
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: ["organization-stats", organizationId],
      });
    },
  });
}

export function useDeleteDataset(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datasetId: string) =>
      fetchApi<void>(`/api/dash/${organizationId}/dataset/${datasetId}`, {
        method: "DELETE",
      }),
    onSuccess: async (_response, datasetId) => {
      const queryKey = [QueryKeys.Datasets, organizationId];
      await Promise.all([
        queryClient.cancelQueries({ queryKey }),
        queryClient.cancelQueries({
          queryKey: [QueryKeys.DatasetFields, organizationId, datasetId],
        }),
        queryClient.cancelQueries({
          queryKey: [QueryKeys.Logs, organizationId, datasetId],
        }),
      ]);
      queryClient.setQueryData<Dataset[]>(queryKey, (datasets = []) =>
        datasets.filter((dataset) => dataset.id !== datasetId),
      );
      queryClient.removeQueries({
        queryKey: [QueryKeys.DatasetFields, organizationId, datasetId],
      });
      queryClient.removeQueries({
        queryKey: [QueryKeys.Logs, organizationId, datasetId],
      });
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({
        queryKey: ["organization-stats", organizationId],
      });
    },
  });
}
