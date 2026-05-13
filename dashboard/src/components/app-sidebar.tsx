"use client"

import * as React from "react"
import {
  IconBell,
  IconChartBar,
  IconClipboardCheck,
  IconDashboard,
  IconListSearch,
  IconLogout,
  IconPlug,
  IconRobot,
  IconSearch,
  IconSettings,
  IconShieldCheck,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"

const navMain = [
  { title: "Dashboard", url: "/", icon: IconDashboard },
  { title: "Agents", url: "/agents", icon: IconRobot },
  { title: "Connectors", url: "/connectors", icon: IconPlug },
  { title: "Policies", url: "/policies", icon: IconShieldCheck },
  { title: "Approvals", url: "/approvals", icon: IconClipboardCheck },
  { title: "Audit Logs", url: "/audit-logs", icon: IconListSearch },
  { title: "Notifications", url: "/notifications", icon: IconBell },
  { title: "Analytics", url: "/analytics", icon: IconChartBar },
]

const navSecondary = [
  { title: "Settings", url: "/settings", icon: IconSettings },
  { title: "Search", url: "#", icon: IconSearch },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { logout } = useAuth()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <a href="/">
                <IconShieldCheck className="size-5!" />
                <span className="text-base font-semibold">Inflection</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs text-muted-foreground" onClick={logout}>
            <IconLogout className="size-4" />
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
