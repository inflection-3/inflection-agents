import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { ClipboardCopy, Copy, MoreHorizontal, Plus, RotateCcw } from "lucide-react"
import type {Agent} from "@/lib/api";
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  
  createAgent,
  deleteAgent,
  fetchAgents,
  updateAgent
} from "@/lib/api"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

export const Route = createFileRoute("/agents")({ component: AgentsPage })

function AgentsPage() {
  const [agentList, setAgentList] = useState<Array<Agent>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [newAgent, setNewAgent] = useState<{ name: string; id: string } | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
      const data = await fetchAgents()
      setAgentList(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get("name") || "")
    const description = String(form.get("description") || "")
    try {
      const agent = await createAgent({ name, description: description || undefined })
      setNewAgent({ name: agent.name, id: agent.id })
      setAgentList((prev) => [agent, ...prev])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const finishRegister = () => {
    setNewAgent(null)
    setRegisterOpen(false)
  }

  const toggleStatus = async (id: string) => {
    const agent = agentList.find((a) => a.id === id)
    if (!agent) return
    const next = agent.status === "active" ? "suspended" : "active"
    try {
      await updateAgent(id, { status: next })
      setAgentList((prev) => prev.map((a) => (a.id === id ? { ...a, status: next } : a)))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const removeAgent = async (id: string) => {
    try {
      await deleteAgent(id)
      setAgentList((prev) => prev.filter((a) => a.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
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
                </div>
                <DialogFooter>
                  <Button onClick={finishRegister} size="sm">Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-1 pt-2 px-3">
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <Skeleton className="h-3 w-48 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agentList.length === 0 ? (
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
                      <DropdownMenuItem onClick={() => alert("Rename not implemented")}>Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alert("Regenerate not implemented")}>
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
                {agent.description && (
                  <div className="text-muted-foreground text-[10px]">{agent.description}</div>
                )}
                <div className="flex items-center gap-3 text-muted-foreground text-[10px]">
                  <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5">
                  <Link to="/connectors" className="text-primary hover:underline text-[10px]">Connectors</Link>
                  <Link to="/policies" className="text-primary hover:underline text-[10px]">Policies</Link>
                  <Link to="/audit-logs" className="text-primary hover:underline text-[10px]">Audit Logs</Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
