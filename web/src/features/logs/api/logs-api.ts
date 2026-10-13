import { Field, Log, QueryLogResponse, ListLogsSchema } from "@/typings/logs";
import { QueryKeys } from "@/typings/query";
import { fetchApi } from "@/utils/http-util";
import { useQuery } from "@tanstack/react-query";

export function useListFields(
  organizationId: string | undefined,
  datasetId: string | undefined,
) {
  return useQuery({
    queryKey: [QueryKeys.DatasetFields, organizationId, datasetId],
    enabled: !!organizationId && !!datasetId,
    queryFn: ({ signal }) =>
      fetchApi<Field[]>(
        `/api/dash/${organizationId}/dataset/${datasetId}/fields`,
        { signal },
      ),
  });
}

export function queryLogs(
  organizationId: string,
  datasetId: string,
  params: ListLogsSchema,
  signal: AbortSignal,
) {
  return fetchApi<QueryLogResponse>(
    `/api/dash/${organizationId}/dataset/${datasetId}/logs`,
    {
      method: "POST",
      body: JSON.stringify(params),
      signal,
    },
  );
}

export function useLog(
  organizationId: string | undefined,
  datasetId: string | undefined,
  logId: string | null,
) {
  return useQuery({
    queryKey: [QueryKeys.Logs, organizationId, datasetId, logId],
    enabled: !!organizationId && !!datasetId && !!logId,
    queryFn: ({ signal }) =>
      fetchApi<Log>(
        `/api/dash/${organizationId}/dataset/${datasetId}/logs/${logId}`,
        { signal },
      ),
  });
}
