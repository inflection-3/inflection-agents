import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { pendingApprovals as initialPending, recentDecisions } from "@/lib/data"
import { CheckCircle, ChevronDown } from "lucide-react"

export const Route = createFileRoute("/approvals")({ component: ApprovalsPage })

function formatCountdown(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function ApprovalsPage() {
  const [pending, setPending] = useState(initialPending)
  const [now, setNow] = useState(Date.now())
  const [actionState, setActionState] = useState<Record<string, { mode: "approve" | "reject"; reason: string }>>({})

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleAction = (id: string, mode: "approve" | "reject") => {
    setActionState((prev) => ({ ...prev, [id]: { mode, reason: "" } }))
  }

  const confirmAction = (id: string) => {
    setPending((prev) => prev.filter((p) => p.id !== id))
    setActionState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const sortedPending = [...pending].sort((a, b) => new Date(a.timeoutAt).getTime() - new Date(b.timeoutAt).getTime())

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Approvals</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pending Approvals</h1>
        <Badge variant="secondary" className="text-[10px]">{pending.length} pending</Badge>
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <CheckCircle className="size-6 text-primary" />
          <h2 className="text-sm font-medium">No pending approvals</h2>
          <p className="text-xs text-muted-foreground">All transactions are flowing through automatically.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedPending.map((item) => {
            const timeoutMs = new Date(item.timeoutAt).getTime() - now
            const state = actionState[item.id]
            return (
              <Card key={item.id} className="border-l-4 border-l-yellow-400">
                <CardContent className="flex flex-col gap-2 pt-3 px-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold">${item.amount.toLocaleString()}</div>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.rail}</Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.agent}</Badge>
                    </div>
                  </div>
                  <div className="font-mono text-xs">
                    {item.action} → {item.args.destination || item.args.customerId || ""}
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Held {item.waitingMin} min ago</span>
                    <span className={timeoutMs < 300000 ? "text-orange-400" : ""}>
                      Auto-denies in {timeoutMs > 0 ? formatCountdown(timeoutMs) : "now"}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Policy: {item.policyRule} threshold: ${item.policyThreshold.toLocaleString()}
                  </div>
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                      View full details <ChevronDown className="size-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-1.5 rounded-md bg-accent p-2 text-[10px] font-mono overflow-auto">
                        {JSON.stringify(item.args, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                  {state ? (
                    <div className="flex flex-col gap-1.5">
                      <Textarea
                        placeholder="Add a reason (optional)"
                        className="h-14 text-xs"
                        value={state.reason}
                        onChange={(e) =>
                          setActionState((prev) => ({
                            ...prev,
                            [item.id]: { ...prev[item.id], reason: e.target.value },
                          }))
                        }
                      />
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-6 text-xs"
                          onClick={() =>
                            setActionState((prev) => {
                              const next = { ...prev }
                              delete next[item.id]
                              return next
                            })
                          }
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-6 text-xs"
                          variant={state.mode === "reject" ? "destructive" : "default"}
                          onClick={() => confirmAction(item.id)}
                        >
                          Confirm {state.mode === "approve" ? "Approve" : "Reject"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 justify-end">
                      <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => handleAction(item.id, "reject")}>
                        Reject
                      </Button>
                      <Button size="sm" className="h-6 text-xs" onClick={() => handleAction(item.id, "approve")}>Approve</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold">Recent Decisions</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 text-xs">Transaction</TableHead>
                <TableHead className="h-7 text-xs">Agent</TableHead>
                <TableHead className="h-7 text-xs">Rail</TableHead>
                <TableHead className="h-7 text-xs">Amount</TableHead>
                <TableHead className="h-7 text-xs">Decision</TableHead>
                <TableHead className="h-7 text-xs">By</TableHead>
                <TableHead className="h-7 text-xs">Reason</TableHead>
                <TableHead className="h-7 text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDecisions.map((d) => (
                <TableRow key={d.txId}>
                  <TableCell className="py-1.5 font-mono text-[10px]">{d.txId}</TableCell>
                  <TableCell className="py-1.5 text-xs">{d.agent}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{d.rail}</Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">${d.amount.toLocaleString()}</TableCell>
                  <TableCell className="py-1.5">
                    <DecisionBadge decision={d.decision} />
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">{d.by}</TableCell>
                  <TableCell className="py-1.5 text-[10px] text-muted-foreground">{d.reason || "—"}</TableCell>
                  <TableCell className="py-1.5 text-[10px] text-muted-foreground">{d.decidedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "APPROVED") {
    return <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">APPROVED</Badge>
  }
  if (decision === "REJECTED") {
    return <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">REJECTED</Badge>
  }
  return <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">TIMEOUT</Badge>
}
