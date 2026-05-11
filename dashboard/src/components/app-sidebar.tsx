"use client"

import * as React from "react"
import {
  IconBell,
  IconChartBar,
  IconClipboardCheck,
  IconDashboard,
  IconListSearch,
  IconPlug,
  IconRobot,
  IconSearch,
  IconSettings,
  IconShieldCheck,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: IconDashboard,
    },
    {
      title: "Agents",
      url: "/agents",
      icon: IconRobot,
    },
    {
      title: "Connectors",
      url: "/connectors",
      icon: IconPlug,
    },
    {
      title: "Policies",
      url: "/policies",
      icon: IconShieldCheck,
    },
    {
      title: "Approvals",
      url: "/approvals",
      icon: IconClipboardCheck,
    },
    {
      title: "Audit Logs",
      url: "/audit-logs",
      icon: IconListSearch,
    },
    {
      title: "Notifications",
      url: "/notifications",
      icon: IconBell,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "Search",
      url: "#",
      icon: IconSearch,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/">
                <IconShieldCheck className="size-5!" />
                <span className="text-base font-semibold">Inflection</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
