import { QueryKeys } from "@/typings/query";
import { Params } from "@/typings/router";
import { TokenParams, TokenPreview } from "@/typings/token";
import { fetchApi } from "@/utils/http-util";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router";

export function useCreateToken() {
  const params = useParams<Params>();

  return useMutation({
    mutationKey: [QueryKeys.CreateToken],
    mutationFn: (tokenParams: TokenParams) =>
      fetchApi<TokenPreview>(`/api/dash/${params.organizationId}/token`, {
        method: "POST",
        body: JSON.stringify(tokenParams),
      }),
  });
}
