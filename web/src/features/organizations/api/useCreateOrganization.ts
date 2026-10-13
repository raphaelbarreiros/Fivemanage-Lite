import { CreateOrganizationSchema, Organization } from "@/typings/organizations";
import { fetchApi } from "@/utils/http-util";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (params: CreateOrganizationSchema) =>
      fetchApi<Organization>("/api/dash/organization", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: (organization) => {
      void queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Organization created");
      navigate(organization ? `/app/${organization.id}` : "/app", {
        replace: true,
      });
    },
    onError: (error) => toast.error(error.message),
  });
}
