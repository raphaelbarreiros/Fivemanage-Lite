import { Params } from "@/typings/router";
import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router";
import { fetchApi } from "@/utils/http-util";

export function useUploadFile() {
  const params = useParams<Params>();

  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      return fetchApi(
        `/api/dash/storage/${params.organizationId}/upload`,
        {
          method: "POST",
          body: formData,
        },
      );
    },
  });

  return { mutate, mutateAsync, isPending };
}
