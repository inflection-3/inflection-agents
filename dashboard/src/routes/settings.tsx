import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Copy, Plus } from "lucide-react"
import type {Agent, ApiKey} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {   createApiKey, fetchAgents, fetchApiKeys, revokeApiKey } from "@/lib/api"

export const Route = createFileRoute("/settings")({ component: SettingsPage })

function SettingsPage() {
  const [agents, setAgents] = useState<Array<Agent>>([])
  const [apiKeys, setApiKeys] = useState<Record<string, Array<ApiKey> | undefined>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState("")
  const [newKey, setNewKey] = useState<{ rawKey: string; prefix: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const ags = await fetchAgents()
      setAgents(ags.filter((a) => a.status !== "deleted"))
      const keysMap: Record<string, Array<ApiKey>> = {}
      await Promise.all(
        ags.map(async (a) => {
          try {
            const keys = await fetchApiKeys(a.id)
            keysMap[a.id] = keys
          } catch {
            // ignore
          }
        })
      )
      setApiKeys(keysMap)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedAgent) return
    try {
      const data = await createApiKey(selectedAgent, "live")
      setNewKey({ rawKey: data.rawKey, prefix: data.keyPrefix })
      setApiKeys((prev) => ({
        ...prev,
        [selectedAgent]: [...(prev[selectedAgent] || []), { id: data.id, agentId: data.agentId, keyPrefix: data.keyPrefix, mode: data.mode as "live" | "test", status: "active", lastUsedAt: null, createdAt: new Date().toISOString() }],
      }))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const revokeKey = async (agentId: string, keyId: string) => {
    try {
      await revokeApiKey(agentId, keyId)
      setApiKeys((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] || []).filter((k) => k.id !== keyId),
      }))
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
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-lg font-semibold">Settings</h1>
      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <Tabs defaultValue="api-keys">
        <TabsList className="h-7">
          <TabsTrigger value="api-keys" className="text-xs h-6">API Keys</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs h-6">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Agent API Keys</h2>
            <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-6 text-[10px]">
                  <Plus className="size-3 mr-1" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-sm">Create API Key</DialogTitle>
                  <DialogDescription className="text-xs">Generate a new SDK API key for an agent.</DialogDescription>
                </DialogHeader>
                {!newKey ? (
                  <form onSubmit={handleCreateKey} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Agent</Label>
                      <select
                        className="h-8 text-xs rounded-md border px-2"
                        value={selectedAgent}
                        onChange={(e) => setSelectedAgent(e.target.value)}
                        required
                      >
                        <option value="">Select an agent...</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                    <DialogFooter>
                      <Button size="sm" type="submit">Create</Button>
                    </DialogFooter>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-md bg-accent p-3 flex flex-col gap-1.5">
                      <p className="text-[10px] text-muted-foreground">Your new API key (copy it now — you won't see it again):</p>
                      <div className="flex items-center gap-1.5">
                        <code className="font-mono text-xs break-all">{newKey.rawKey}</code>
                        <Button size="icon" variant="ghost" className="size-5 shrink-0" onClick={() => navigator.clipboard.writeText(newKey.rawKey)}>
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button size="sm" onClick={() => { setNewKey(null); setCreateKeyOpen(false) }}>Done</Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : (
            <div className="flex flex-col gap-4">
              {agents.map((agent) => {
                const keys = apiKeys[agent.id] || []
                return (
                  <div key={agent.id}>
                    <h3 className="text-xs font-semibold mb-1">{agent.name}</h3>
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-7 text-xs">Prefix</TableHead>
                            <TableHead className="h-7 text-xs">Mode</TableHead>
                            <TableHead className="h-7 text-xs">Status</TableHead>
                            <TableHead className="h-7 text-xs">Created</TableHead>
                            <TableHead className="h-7 text-xs"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {keys.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-xs text-muted-foreground py-2">No keys</TableCell>
                            </TableRow>
                          ) : (
                            keys.map((k) => (
                              <TableRow key={k.id}>
                                <TableCell className="py-1.5 font-mono text-[10px]">{k.keyPrefix}</TableCell>
                                <TableCell className="py-1.5 text-xs">{k.mode}</TableCell>
                                <TableCell className="py-1.5">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${k.status === "active" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {k.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-1.5 text-[10px] text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</TableCell>
                                <TableCell className="py-1.5">
                                  {k.status === "active" && (
                                    <Button size="sm" variant="destructive" className="h-5 text-[10px]" onClick={() => revokeKey(agent.id, k.id)}>
                                      Revoke
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-2">
          <Card>
            <CardContent className="p-3 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">Profile settings coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
