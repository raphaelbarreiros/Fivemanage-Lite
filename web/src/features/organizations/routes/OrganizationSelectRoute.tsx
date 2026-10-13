import { Navigate, NavLink, useNavigate } from "react-router";
import { useOrganizations } from "../api/useOrganizations";
import { useSession, useLogout } from "@/features/auth/api/useSession";
import { CirclePlus, ChevronRight, LogOut } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function OrganizationSelectRoute() {
  const { data, isLoading, error, refetch } = useOrganizations();
  const session = useSession();
  const { logout, isPending: isLoggingOut } = useLogout();
  const orgCount = data?.length || 0;
  const navigate = useNavigate();

  if (!session.data && !session.isPending) {
    return <Navigate to="/auth" />;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <p role="alert">{error.message}</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <Navigate to="/app/new-organization" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md flex flex-col bg-accent">
        <CardHeader className="border-b">
          <CardTitle className="text-center text-2xl">
            Select Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-72 px-4 py-4 overflow-y-auto">
            <Button
              variant="outline"
              className="w-full justify-start mb-2"
              onClick={() => navigate("/app/new-organization")}
            >
              <CirclePlus className="mr-2 h-4 w-4" />
              Create New Team
            </Button>
            <ul className="flex flex-col gap-2">
              {data.map((org) => (
                <li key={org.id} className="w-full">
                  <NavLink
                    to={`/app/${org.id}`}
                    state={{ organization: org }}
                    className="flex items-center gap-4 rounded-lg py-2 px-4 hover:bg-accent transition-colors"
                  >
                    <span className="flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold h-10 w-10">
                      {org.name.charAt(0)}
                    </span>
                    <div className="grow">
                      <p className="text-sm font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ID: {org.id}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center border-t px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {orgCount} workspace{orgCount === 1 ? "" : "s"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            disabled={isLoggingOut}
            className="gap-1.5"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
