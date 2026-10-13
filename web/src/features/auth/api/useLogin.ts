import { LoginSchema } from "@/typings/auth";
import { fetchApi } from "@/utils/http-util";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/typings/query";
import { useNavigate } from "react-router";

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginSchema) =>
      fetchApi("/api/dash/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QueryKeys.Session] });
      navigate("/app");
    },
  });
}
