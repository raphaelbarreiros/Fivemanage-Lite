import { Organization } from "@/typings/organizations";
import { fetchApi } from "@/utils/http-util";
import { useQuery } from "@tanstack/react-query";

export function useCurrentOrganization(organizationId: string | undefined) {
  return useQuery({
    queryKey: [organizationId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fetchApi<Organization>(`/api/dash/organization/${organizationId}`),
  });
}
