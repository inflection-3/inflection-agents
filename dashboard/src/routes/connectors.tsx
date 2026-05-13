import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { AlertTriangle, Plus } from "lucide-react"
import type {Agent, Connector} from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
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
import {   createConnector, fetchAgents, fetchConnectors, revokeConnector } from "@/lib/api"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"

export const Route = createFileRoute("/connectors")({ component: ConnectorsPage })

const railColors: Record<string, string> = {
  stripe: "border-l-[#635BFF]",
  circle: "border-l-[#0066FF]",
  x402: "border-l-primary",
  square: "border-l-orange-400",
  braintree: "border-l-cyan-400",
  razorpay: "border-l-blue-400",
}

const railLabels: Record<string, string> = {
  stripe: "Stripe",
  circle: "Circle",
  x402: "x402",
  square: "Square",
  braintree: "Braintree",
  razorpay: "Razorpay",
}

function ConnectorsPage() {
  const [accounts, setAccounts] = useState<Array<Connector>>([])
  const [agents, setAgents] = useState<Array<Agent>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [connectOpen, setConnectOpen] = useState(false)
  const [connectStep, setConnectStep] = useState<"rail" | "form" | "success">("rail")
  const [selectedRail, setSelectedRail] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState("")
  const [credentialInput, setCredentialInput] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [conns, ags] = await Promise.all([fetchConnectors(), fetchAgents()])
      setAccounts(conns)
      setAgents(ags)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startConnect = (rail: string) => {
    setSelectedRail(rail)
    setConnectStep("form")
  }

  const finishConnect = async () => {
    if (!selectedRail || !selectedAgent || !credentialInput) return
    const isWallet = selectedRail === "x402"
    try {
      const conn = await createConnector({
        agentId: selectedAgent,
        rail: selectedRail,
        authType: isWallet ? "wallet" : "api_key",
        credentials: isWallet ? { privateKey: credentialInput } : { apiKey: credentialInput },
      })
      setAccounts((prev) => [...prev, conn])
      setConnectStep("success")
    } catch (err: any) {
      setError(err.message)
    }
  }

  const revokeAccount = async (id: string) => {
    try {
      await revokeConnector(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const rails = ["stripe", "circle", "x402", "square", "braintree", "razorpay"]
  const lockedRails = ["square", "braintree", "razorpay"]

  const agentHasConnector = (agentId: string, rail: string) => {
    return accounts.some((c) => c.agentId === agentId && c.rail === rail && c.status === "active")
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
            <BreadcrumbPage>Connectors</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Connectors</h1>
        <Dialog open={connectOpen} onOpenChange={(o) => { setConnectOpen(o); if (!o) { setConnectStep("rail"); setSelectedRail(null); setSelectedAgent(""); setCredentialInput("") } }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-3.5 mr-1" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm">Connect Account</DialogTitle>
              <DialogDescription className="text-xs">Link a payment provider to an agent.</DialogDescription>
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
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors ${locked ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:bg-accent"}`}
                    >
                      <span className="text-sm font-semibold capitalize">{rail}</span>
                      {locked && <Badge variant="secondary" className="text-[10px]">Coming soon</Badge>}
                    </button>
                  )
                })}
              </div>
            )}
            {connectStep === "form" && selectedRail && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Authenticate your {railLabels[selectedRail] || selectedRail} account.
                </p>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Agent</Label>
                  <select
                    className="h-8 text-xs rounded-md border px-2"
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                  >
                    <option value="">Select an agent...</option>
                    {agents.filter((a) => a.status === "active" && !agentHasConnector(a.id, selectedRail)).map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">{selectedRail === "x402" ? "Private Key" : "API Key"}</Label>
                  <Input
                    placeholder={selectedRail === "x402" ? "0x..." : "sk_..."}
                    className="h-7 text-xs"
                    value={credentialInput}
                    onChange={(e) => setCredentialInput(e.target.value)}
                  />
                </div>
                <Button size="sm" disabled={!selectedAgent || !credentialInput} onClick={finishConnect}>Connect</Button>
              </div>
            )}
            {connectStep === "success" && (
              <div className="flex flex-col items-center gap-3 py-3">
                <div className="text-xl">✓</div>
                <p className="text-sm font-medium">Account connected successfully!</p>
                <DialogFooter className="w-full">
                  <Button size="sm" onClick={() => { setConnectOpen(false); setConnectStep("rail"); setSelectedRail(null); setSelectedAgent(""); setCredentialInput(""); }}>Done</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-1 pt-2 px-3">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent className="px-3 pb-2">
                <Skeleton className="h-3 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
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
                      <Badge className={`text-[10px] px-1.5 py-0 ${account.status === "active" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                        {account.status.toUpperCase()}
                      </Badge>
                    </div>
                    <CardDescription className="text-[10px]">
                      {account.maskedCredential}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-xs px-3 pb-2">
                    <div className="text-muted-foreground text-[10px]">Connected {new Date(account.createdAt).toLocaleDateString()}</div>
                    <div className="text-muted-foreground text-[10px]">Agent: {agents.find((a) => a.id === account.agentId)?.name || account.agentId}</div>
                    <div className="flex gap-1.5 pt-0.5">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive">Revoke</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-sm">Revoke {railLabels[account.rail]} connection?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                              This will immediately block this agent from making {account.rail} calls. This cannot be undone.
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
                  {agents.filter((a) => a.status !== "deleted").map((agent) => {
                    const agentAccounts = accounts.filter((a) => a.agentId === agent.id && a.status === "active")
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
