import { QueryKeys } from "@/typings/query";
import { Session } from "@/typings/user";
import { fetchApi } from "@/utils/http-util";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useSession() {
  const { data, isPending, error } = useQuery({
    queryKey: [QueryKeys.Session],
    queryFn: () => fetchApi<Session>("/api/dash/auth/session"),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return { data, isPending, error, isAuthenticated: !!data };
}

export function useLogout() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetchApi("/api/dash/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/auth";
    },
    onError: (error) => toast.error(error.message),
  });

  return { logout: () => { if (!isPending) mutate(); }, isPending };
}
