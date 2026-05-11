import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { connectedAccounts, agents } from "@/lib/data"
import { Plus, AlertTriangle } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

export const Route = createFileRoute("/connectors")({ component: ConnectorsPage })

const railColors: Record<string, string> = {
  stripe: "border-l-[#635BFF]",
  circle: "border-l-[#0066FF]",
  x402: "border-l-primary",
}

const railLabels: Record<string, string> = {
  stripe: "Stripe",
  circle: "Circle",
  x402: "x402",
}

function ConnectorsPage() {
  const [accounts, setAccounts] = useState<any[]>(connectedAccounts)
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectStep, setConnectStep] = useState<"rail" | "auth" | "success">("rail")
  const [selectedRail, setSelectedRail] = useState<string | null>(null)
  const [assignOpen, setAssignOpen] = useState<string | null>(null)

  const startConnect = (rail: string) => {
    setSelectedRail(rail)
    setConnectStep("auth")
  }

  const finishConnect = () => {
    if (!selectedRail) return
    const id = "con_" + selectedRail + "_" + Math.random().toString(36).slice(2, 6)
    setAccounts((prev) => [
      ...prev,
      {
        id,
        rail: selectedRail as "stripe" | "circle" | "x402",
        accountId: selectedRail === "x402" ? "0x" + Math.random().toString(16).slice(2, 10) : "acct_" + Math.random().toString(36).slice(2, 8),
        accountLabel: selectedRail === "x402" ? "Agent Wallet" : "New Account",
        status: "active" as const,
        connectedAt: new Date().toISOString().slice(0, 10),
        assignedAgents: [],
      },
    ])
    setConnectStep("success")
  }

  const revokeAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  const assignAgents = (accountId: string, agentIds: string[]) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === accountId ? { ...a, assignedAgents: agentIds } : a
      )
    )
    setAssignOpen(null)
  }

  const rails = ["stripe", "circle", "x402", "square", "braintree", "razorpay"]
  const lockedRails = ["square", "braintree", "razorpay"]

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Connectors</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Connectors</h1>
        <Dialog open={connectOpen} onOpenChange={(o) => { setConnectOpen(o); if (!o) { setConnectStep("rail"); setSelectedRail(null) } }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">Connect Account</DialogTitle>
              <DialogDescription className="text-xs">Link a payment provider to Inflection.</DialogDescription>
            </DialogHeader>
            {connectStep === "rail" && (
              <div className="grid grid-cols-3 gap-2">
                {rails.map((rail) => {
                  const locked = lockedRails.includes(rail)
                  return (
                    <button
                      key={rail}
                      disabled={locked}
                      onClick={() => !locked && startConnect(rail)}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${
                        locked ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:bg-accent"
                      }`}
                    >
                      <span className="text-sm font-semibold capitalize">{rail}</span>
                      {locked && <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>}
                    </button>
                  )
                })}
              </div>
            )}
            {connectStep === "auth" && selectedRail && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Authenticate your {railLabels[selectedRail] || selectedRail} account.
                </p>
                {selectedRail === "stripe" ? (
                  <Button size="sm" onClick={finishConnect}>Connect with Stripe</Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">{selectedRail === "x402" ? "Wallet Address" : "API Key"}</Label>
                      <Input placeholder={selectedRail === "x402" ? "0x..." : "sk_..."} className="h-7 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Label (optional)</Label>
                      <Input placeholder="e.g. Production" className="h-7 text-xs" />
                    </div>
                    <Button size="sm" onClick={finishConnect}>Connect</Button>
                  </div>
                )}
              </div>
            )}
            {connectStep === "success" && (
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="text-xl">✓</div>
                <p className="text-sm font-medium">Account connected successfully!</p>
                <DialogFooter className="w-full">
                  <Button size="sm" onClick={() => { setConnectOpen(false); setConnectStep("rail"); setSelectedRail(null) }}>Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-xs text-muted-foreground">No payment accounts connected yet.</p>
          <Button size="sm" onClick={() => setConnectOpen(true)}>Connect Account</Button>
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-semibold mb-2">Connected Accounts</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <Card key={account.id} className={`border-l-4 ${railColors[account.rail] || "border-l-muted"}`}>
                  <CardHeader className="pb-1 pt-2 px-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-semibold capitalize">{railLabels[account.rail] || account.rail}</CardTitle>
                      <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">{account.status.toUpperCase()}</Badge>
                    </div>
                    <CardDescription className="text-[10px]">
                      {account.accountLabel ? `${account.accountLabel} (${account.accountId})` : account.accountId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-xs px-3 pb-2">
                    <div className="text-muted-foreground text-[10px]">Connected {account.connectedAt}</div>
                    <div className="text-muted-foreground text-[10px]">Used by {account.assignedAgents.length} agent{account.assignedAgents.length !== 1 ? "s" : ""}</div>
                    <div className="flex gap-1.5 pt-0.5">
                      <Dialog open={assignOpen === account.id} onOpenChange={(o) => setAssignOpen(o ? account.id : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]">Assign to Agent</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="text-sm">Assign to Agent</DialogTitle>
                            <DialogDescription className="text-xs">Choose agents that can use this connector.</DialogDescription>
                          </DialogHeader>
                          <AssignForm
                            account={account}
                            agents={agents}
                            onSave={(ids) => assignAgents(account.id, ids)}
                          />
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive">Revoke</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm">Revoke {railLabels[account.rail]} connection?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                              This will immediately block assigned agents from making {account.rail} calls. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="h-7 text-xs">Cancel</AlertDialogCancel>
                            <AlertDialogAction className="h-7 text-xs bg-destructive text-destructive-foreground" onClick={() => revokeAccount(account.id)}>
                              Revoke
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <h2 className="text-sm font-semibold mb-2">Agent Assignments</h2>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-7 text-xs">Agent</TableHead>
                    <TableHead className="h-7 text-xs">Rails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => {
                    const agentAccounts = accounts.filter((a) => a.assignedAgents.includes(agent.id))
                    return (
                      <TableRow key={agent.id}>
                        <TableCell className="py-1.5 text-xs font-medium">{agent.name}</TableCell>
                        <TableCell className="py-1.5">
                          {agentAccounts.length === 0 ? (
                            <div className="flex items-center gap-1.5 text-yellow-400">
                              <AlertTriangle className="size-3" />
                              <span className="text-[10px]">No connectors assigned — this agent will DENY all payment calls.</span>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              {agentAccounts.map((a) => (
                                <Badge key={a.id} variant="outline" className="capitalize text-[10px] px-1.5 py-0">
                                  {a.rail}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function AssignForm({
  account,
  agents,
  onSave,
}: {
  account: (typeof connectedAccounts)[0]
  agents: typeof import("@/lib/data").agents
  onSave: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(account.assignedAgents)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {agents.map((agent) => {
          const alreadyAssigned = account.assignedAgents.includes(agent.id)
          return (
            <label key={agent.id} className={`flex items-center gap-2 rounded-md border p-2 ${alreadyAssigned ? "opacity-60" : ""}`}>
              <Checkbox
                checked={selected.includes(agent.id)}
                disabled={alreadyAssigned}
                onCheckedChange={(checked) => {
                  setSelected((prev) =>
                    checked ? [...prev, agent.id] : prev.filter((id) => id !== agent.id)
                  )
                }}
              />
              <span className="text-xs font-medium">{agent.name}</span>
              {alreadyAssigned && <Badge variant="secondary" className="ml-auto text-[10px]">Already assigned</Badge>}
            </label>
          )
        })}
      </div>
      <DialogFooter>
        <Button size="sm" onClick={() => onSave(selected)}>Save Assignments</Button>
      </DialogFooter>
    </div>
  )
}
