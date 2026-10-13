import { AssetResponse } from "@/typings/asset";
import { AssetParams } from "@/typings/assets";
import { fetchApi } from "@/utils/http-util";
import { useSuspenseQuery } from "@tanstack/react-query";

export function useStorageFiles(params: AssetParams) {
  const { data, isLoading } = useSuspenseQuery({
    queryKey: [
      "storage",
      params.organizationId,
      params.search,
      params.type,
      params.page,
      params.pageSize,
    ],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.search) queryParams.append("search", params.search);
      if (params.type && params.type !== "all")
        queryParams.append("type", params.type);
      if (params.page !== undefined)
        queryParams.append("page", params.page.toString());
      if (params.pageSize !== undefined)
        queryParams.append("pageSize", params.pageSize.toString());

      const queryString = queryParams.toString();
      const url = `/api/dash/storage/${params.organizationId}${queryString ? `?${queryString}` : ""}`;

      return fetchApi<AssetResponse>(url);
    },
  });

  return {
    data,
    isLoading,
  };
}
