import { HeadContent, Outlet, Scripts, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router"
import { useEffect } from "react"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import appCss from "../styles.css?url"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider, useAuth } from "@/lib/auth-context"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

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
  return (
    <AuthProvider>
      <RootDocument />
    </AuthProvider>
  )
}

function RootDocument() {
  const { isAuthenticated, isLoading } = useAuth()
  const state = useRouterState()
  const navigate = useNavigate()
  const isAuthPage = state.location.pathname === "/login" || state.location.pathname === "/register"

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      navigate({ to: "/login", replace: true })
    }
  }, [isLoading, isAuthenticated, isAuthPage, navigate])

  if (isLoading) {
    return (
      <html lang="en">
        <head><HeadContent /></head>
        <body className="flex items-center justify-center min-h-svh">
          <div className="text-sm text-muted-foreground">Loading...</div>
          <Scripts />
        </body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <TooltipProvider>
          {isAuthPage ? (
            <Outlet />
          ) : !isAuthenticated ? (
            <div className="flex items-center justify-center min-h-svh">
              <div className="text-sm text-muted-foreground">Redirecting to login...</div>
            </div>
          ) : (
            <SidebarProvider
              style={{
                "--sidebar-width": "calc(var(--spacing) * 72)",
                "--header-height": "calc(var(--spacing) * 12)",
              } as React.CSSProperties}
            >
              <AppSidebar variant="inset" />
              <SidebarInset>
                <Outlet />
              </SidebarInset>
            </SidebarProvider>
          )}
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
          />
          <Scripts />
        </TooltipProvider>
      </body>
    </html>
  )
}
