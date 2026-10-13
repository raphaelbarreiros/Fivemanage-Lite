import { fetchApi } from "@/utils/http-util";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router";

export function useDeleteToken() {
  const { organizationId } = useParams();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: (tokenId: number) =>
      fetchApi(`/api/dash/${organizationId}/token/${tokenId}`, {
        method: "DELETE",
      }),
  });

  return { mutateAsync, isPending };
}
