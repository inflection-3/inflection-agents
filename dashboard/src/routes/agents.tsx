import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { agents } from "@/lib/data"
import { ClipboardCopy, MoreHorizontal, Plus, Copy, RotateCcw } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

export const Route = createFileRoute("/agents")({ component: AgentsPage })

function AgentsPage() {
  const [agentList, setAgentList] = useState(agents)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [newAgent, setNewAgent] = useState<{ name: string; id: string; apiKey: string } | null>(null)

  const handleRegister = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get("name") || "")
    const id = "agt_" + Math.random().toString(36).slice(2, 10)
    const apiKey = "sk_inf_" + Math.random().toString(36).slice(2, 10) + "_live_••••••••••••••••"
    setNewAgent({ name, id, apiKey })
  }

  const finishRegister = () => {
    if (!newAgent) return
    setAgentList((prev) => [
      {
        id: newAgent.id,
        name: newAgent.name,
        status: "active" as const,
        apiKey: newAgent.apiKey,
        createdAt: new Date().toISOString().slice(0, 10),
        lastCallAt: "Never",
        connectorCount: 0,
        policyCount: 0,
        txCount: 0,
      },
      ...prev,
    ])
    setNewAgent(null)
    setRegisterOpen(false)
  }

  const toggleStatus = (id: string) => {
    setAgentList((prev) =>
      prev.map((a) => ({
        ...a,
        status: a.id === id ? (a.status === "active" ? "inactive" : "active") : a.status,
      }))
    )
  }

  const removeAgent = (id: string) => {
    setAgentList((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Agents</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Agents</h1>
        <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" />
              Register New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-sm">Register New Agent</DialogTitle>
              <DialogDescription className="text-xs">Create a new agent identity for SDK authentication.</DialogDescription>
            </DialogHeader>
            {!newAgent ? (
              <form onSubmit={handleRegister} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="name" className="text-xs">Agent Name</Label>
                  <Input id="name" name="name" placeholder="e.g. payment-agent" className="h-7 text-xs" required />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="description" className="text-xs">Description (optional)</Label>
                  <Input id="description" name="description" placeholder="What does this agent do?" className="h-7 text-xs" />
                </div>
                <DialogFooter>
                  <Button type="submit" size="sm">Register</Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-md bg-accent p-3 flex flex-col gap-1.5">
                  <div className="text-[10px] text-muted-foreground">Agent ID</div>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <code>{newAgent.id}</code>
                    <Button size="icon" variant="ghost" className="size-5" onClick={() => navigator.clipboard.writeText(newAgent.id)}>
                      <Copy className="size-3" />
                    </Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">API Key</div>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <code>{newAgent.apiKey}</code>
                    <Button size="icon" variant="ghost" className="size-5" onClick={() => navigator.clipboard.writeText(newAgent.apiKey)}>
                      <Copy className="size-3" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={finishRegister} size="sm">Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {agentList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <div className="text-2xl">🤖</div>
          <h2 className="text-sm font-medium">No agents yet</h2>
          <p className="text-xs text-muted-foreground">Register your first agent to get started.</p>
          <Button size="sm" onClick={() => setRegisterOpen(true)}>Register your first agent</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {agentList.map((agent) => (
            <Card key={agent.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-1 pt-2 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md bg-accent">
                      <ClipboardCopy className="size-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-semibold">{agent.name}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${agent.status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {agent.status}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="size-6">
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => alert("Rename not implemented in demo")}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alert("Regenerate not implemented in demo")}>
                        <RotateCcw className="size-3 mr-1.5" />
                        Regenerate API Key
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(agent.id)}>
                        {agent.status === "active" ? "Deactivate" : "Reactivate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => removeAgent(agent.id)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-xs px-3 pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Agent ID:</span>
                  <code className="font-mono text-muted-foreground text-[10px]">{agent.id}</code>
                  <Button size="icon" variant="ghost" className="size-4" onClick={() => navigator.clipboard.writeText(agent.id)}>
                    <Copy className="size-2.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">API Key:</span>
                  <code className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px]">{agent.apiKey}</code>
                  <Button size="icon" variant="ghost" className="size-4" onClick={() => navigator.clipboard.writeText(agent.apiKey)}>
                    <Copy className="size-2.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-4" onClick={() => alert("Regenerate not implemented in demo")}>
                    <RotateCcw className="size-2.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-[10px]">
                  <span>Created: {agent.createdAt}</span>
                  <span>Last call: {agent.lastCallAt}</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Link to="/connectors" className="text-primary hover:underline text-[10px]">
                    {agent.connectorCount} Connectors
                  </Link>
                  <Link to="/policies" className="text-primary hover:underline text-[10px]">
                    {agent.policyCount} Policies
                  </Link>
                  <Link to="/audit-logs" className="text-primary hover:underline text-[10px]">
                    {agent.txCount.toLocaleString()} Tx
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
