import {
  ChartArea,
  Folders,
  KeyRound,
  Layers,
  Settings,
  Users,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router";
import { OrganizationSwitcher } from "@/features/app/components/OrganizationSwitcher";
import { useSession } from "@/features/auth/api/useSession";
import { NavUser } from "@/features/app/components/NavUser";
import { $api } from "@/lib/api/client";

const items = [
  {
    title: "Storage",
    url: "storage",
    icon: Folders,
    comingSoon: false,
  },
  {
    title: "Tokens",
    url: "tokens",
    icon: KeyRound,
    comingSoon: false,
  },
  {
    title: "Logs",
    url: "logs",
    icon: Layers,
    comingSoon: false,
  },
  {
    title: "Team",
    url: "team",
    icon: Users,
    comingSoon: false,
  },
  {
    title: "Usage",
    url: "#",
    icon: ChartArea,
    comingSoon: true,
  },
  {
    title: "Settings",
    url: "settings",
    icon: Settings,
    comingSoon: false,
  },
];

export function AppSidebar() {
  const session = useSession();
  const version = $api.useQuery("get", "/dash/system/version");

  return (
    <Sidebar className="h-full">
      <div className="flex flex-col h-full">
        <SidebarHeader>
          <OrganizationSwitcher />
        </SidebarHeader>
        <SidebarContent className="flex-1">
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Fivemanage Lite ({version.data?.current || "..."})</span>
              {version.data?.update_available && (
                <span
                  className="flex h-2 w-2 rounded-full bg-blue-600"
                  title={`New version available: ${version.data.latest}`}
                />
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.comingSoon && (
                      <SidebarMenuBadge>Coming soon</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          {session.data && (
            <NavUser
              user={{
                name: session.data.name || session.data.username,
                email: session.data.email || "",
                avatar: session.data.avatar || "",
              }}
            />
          )}
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
