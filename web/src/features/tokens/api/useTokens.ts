import { QueryKeys } from "@/typings/query";
import { Token } from "@/typings/token";
import { fetchApi } from "@/utils/http-util";
import { useSuspenseQuery } from "@tanstack/react-query";

export function useTokens(organizationId: string) {
  const result = useSuspenseQuery({
    queryKey: [QueryKeys.Tokens, organizationId],
    queryFn: () => fetchApi<Token[]>(`/api/dash/${organizationId}/token`),
  });

  return result.data;
}
