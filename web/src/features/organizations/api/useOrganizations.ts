import { Organization } from "@/typings/organizations";
import { fetchApi } from "@/utils/http-util";
import { useQuery } from "@tanstack/react-query";

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => fetchApi<Organization[]>("/api/dash/organization"),
  });
}
