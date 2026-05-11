import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
import { apiKeys, teamMembers, plan } from "@/lib/data"
import { Copy, Plus } from "lucide-react"

export const Route = createFileRoute("/settings")({ component: SettingsPage })

function SettingsPage() {
  const [keys, setKeys] = useState(apiKeys)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [newKey, setNewKey] = useState<{ name: string; key: string } | null>(null)

  const handleCreateKey = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const name = String(form.get("name") || "")
    const key = "sk_inf_live_" + Math.random().toString(36).slice(2, 10) + "••••"
    setNewKey({ name, key: key.replace("••••", Math.random().toString(36).slice(2, 10)) })
    setKeys((prev) => [
      ...prev,
      { id: "key_" + Math.random().toString(36).slice(2, 6), name, prefix: key, createdAt: new Date().toISOString().slice(0, 10), lastUsedAt: "Never", scopes: ["gateway:call"] },
    ])
  }

  const revokeKey = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id))
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

      <Tabs defaultValue="profile">
        <TabsList className="h-7">
          <TabsTrigger value="profile" className="text-xs h-6">Profile</TabsTrigger>
          <TabsTrigger value="api-keys" className="text-xs h-6">API Keys</TabsTrigger>
          <TabsTrigger value="team" className="text-xs h-6">Team</TabsTrigger>
          <TabsTrigger value="plan" className="text-xs h-6">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-2">
          <Card>
            <CardContent className="p-3 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-[10px]">Full Name</Label>
                <Input defaultValue="Sarah Chen" className="h-7 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px]">Email</Label>
                <Input defaultValue="sarah@acme.com" disabled className="h-7 text-xs" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-[10px]">Organization</Label>
                <Input defaultValue="Acme Corp" className="h-7 text-xs" />
              </div>
              <Button size="sm" className="w-fit">Save Changes</Button>

              <div className="border-t pt-3 mt-1 flex flex-col gap-2">
                <h3 className="text-xs font-semibold">Password</h3>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px]">Current Password</Label>
                  <Input type="password" className="h-7 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px]">New Password</Label>
                  <Input type="password" className="h-7 text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[10px]">Confirm New Password</Label>
                  <Input type="password" className="h-7 text-xs" />
                </div>
                <Button size="sm" className="w-fit">Update Password</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">SDK API Keys</h2>
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
                  <DialogDescription className="text-xs">Generate a new SDK API key.</DialogDescription>
                </DialogHeader>
                {!newKey ? (
                  <form onSubmit={handleCreateKey} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Key Name</Label>
                      <Input name="name" placeholder="e.g. Production" className="h-7 text-xs" required />
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
                        <code className="font-mono text-xs break-all">{newKey.key}</code>
                        <Button size="icon" variant="ghost" className="size-5 shrink-0" onClick={() => navigator.clipboard.writeText(newKey.key)}>
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 text-xs">Name</TableHead>
                  <TableHead className="h-7 text-xs">Key</TableHead>
                  <TableHead className="h-7 text-xs">Created</TableHead>
                  <TableHead className="h-7 text-xs">Last Used</TableHead>
                  <TableHead className="h-7 text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="py-1.5 text-xs font-medium">{k.name}</TableCell>
                    <TableCell className="py-1.5 font-mono text-[10px]">{k.prefix}</TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">{k.createdAt}</TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">{k.lastUsedAt}</TableCell>
                    <TableCell className="py-1.5">
                      <Button size="sm" variant="destructive" className="h-5 text-[10px]" onClick={() => revokeKey(k.id)}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Team Members</h2>
            <Button size="sm" disabled className="h-6 text-[10px]">
              <Plus className="size-3 mr-1" />
              Invite
              <Badge variant="secondary" className="ml-1.5 text-[10px]">v2</Badge>
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-7 text-xs">Name</TableHead>
                  <TableHead className="h-7 text-xs">Email</TableHead>
                  <TableHead className="h-7 text-xs">Role</TableHead>
                  <TableHead className="h-7 text-xs">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((m) => (
                  <TableRow key={m.email}>
                    <TableCell className="py-1.5 text-xs font-medium">{m.name}</TableCell>
                    <TableCell className="py-1.5 text-xs">{m.email}</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.role}</Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">{m.joinedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-2">
          <Card>
            <CardContent className="p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Current Plan: {plan.tier}</h2>
                <Badge variant="outline" className="text-[10px]">{plan.tier}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span>Gateway Calls</span>
                    <span className="text-muted-foreground">{plan.gatewayCallsUsed.toLocaleString()} / {plan.gatewayCallsLimit.toLocaleString()}</span>
                  </div>
                  <Progress value={(plan.gatewayCallsUsed / plan.gatewayCallsLimit) * 100} className="h-1.5" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span>Active Agents</span>
                    <span className="text-muted-foreground">{plan.activeAgents} / {plan.activeAgentsLimit}</span>
                  </div>
                  <Progress value={(plan.activeAgents / plan.activeAgentsLimit) * 100} className="h-1.5" />
                </div>
              </div>

              <div className="rounded-md border border-primary/30 bg-primary/10 p-3 flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Upgrade to Pro</h3>
                <p className="text-xs text-muted-foreground">Unlimited gateway calls · Up to 20 agents · Priority support</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">$49/month</span>
                  <Button size="sm">Upgrade</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
