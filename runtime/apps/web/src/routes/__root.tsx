import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import {
  BarChart3,
  CheckCircle,
  ChevronRight,
  CreditCard,
  FlaskConical,
  Key,
  LayoutGrid,
  PanelLeft,
  Plug,
  ScrollText,
  Shield,
  Users,
  Webhook,
  Workflow,
} from "lucide-react"
import appCss from "../styles.css?url"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

function AppSidebar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (path: string, exact = false) => {
    if (exact) return currentPath === path
    return currentPath.startsWith(path)
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="gap-3 px-2 pt-3 pb-0">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PanelLeft className="size-4" />
          </div>
          <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
            Inflection
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-1">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/", true)}
                  tooltip="Home"
                >
                  <Link to="/">
                    <LayoutGrid className="size-4" />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/flows")}
                  tooltip="Flows"
                >
                  <Link to="/flows">
                    <Workflow className="size-4" />
                    <span>Flows</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/connectors")}
                  tooltip="Connectors"
                >
                  <Link to="/connectors">
                    <Plug className="size-4" />
                    <span>Connectors</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/approvals")}
                  tooltip="Approvals"
                >
                  <Link to="/approvals">
                    <CheckCircle className="size-4" />
                    <span>Approvals</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/analytics")}
                  tooltip="Analytics"
                >
                  <Link to="/analytics">
                    <BarChart3 className="size-4" />
                    <span>Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/audit-logs")}
                  tooltip="Audit Logs"
                >
                  <Link to="/audit-logs">
                    <ScrollText className="size-4" />
                    <span>Audit Logs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="Evaluator (Phase 3)">
                  <FlaskConical className="size-4" />
                  <span>Evaluator</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings/team")}
                  size="sm"
                  tooltip="Team"
                >
                  <Link to="/settings/team">
                    <Users className="size-4" />
                    <span>Team</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings/guardrails")}
                  size="sm"
                  tooltip="Guardrails"
                >
                  <Link to="/settings/guardrails">
                    <Shield className="size-4" />
                    <span>Guardrails</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings/api-keys")}
                  size="sm"
                  tooltip="API Keys"
                >
                  <Link to="/settings/api-keys">
                    <Key className="size-4" />
                    <span>API Keys</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings/billing")}
                  size="sm"
                  tooltip="Billing"
                >
                  <Link to="/settings/billing">
                    <CreditCard className="size-4" />
                    <span>Billing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/settings/integrations")}
                  size="sm"
                  tooltip="Integrations"
                >
                  <Link to="/settings/integrations">
                    <Webhook className="size-4" />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            JD
          </div>
          <div className="min-w-0 flex-1 text-xs group-data-[collapsible=icon]:hidden">
            <p className="truncate font-medium">Jane Doe</p>
            <p className="truncate text-muted-foreground">jane@acmecorp.com</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Inflection Dashboard" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  component: RootLayout,
})

function RootLayout() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const isCanvas = /^\/flows\/(?!new$)[^/]+/.test(currentPath)

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
              {!isCanvas && (
                <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
                  <SidebarTrigger className="-ml-1" />
                  <Breadcrumbs />
                </header>
              )}
              <div className={isCanvas ? "flex flex-1 overflow-hidden" : "flex flex-1 flex-col gap-4 p-4"}>
                <Outlet />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function Breadcrumbs() {
  const routerState = useRouterState()
  const path = routerState.location.pathname
  const segments = path.split("/").filter(Boolean)

  if (segments.length === 0) return null

  const labels: Record<string, string> = {
    flows: "Flows",
    connectors: "Connectors",
    approvals: "Approvals",
    analytics: "Analytics",
    "audit-logs": "Audit Logs",
    settings: "Settings",
    team: "Team",
    guardrails: "Guardrails",
    "api-keys": "API Keys",
    billing: "Billing",
    integrations: "Integrations",
    executions: "Executions",
  }

  return (
    <div className="flex items-center gap-1 text-sm text-muted-foreground">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3" />}
          <span
            className={
              i === segments.length - 1 ? "font-medium text-foreground" : ""
            }
          >
            {labels[seg] || seg}
          </span>
        </span>
      ))}
    </div>
  )
}
