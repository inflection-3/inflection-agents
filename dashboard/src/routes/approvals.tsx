import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { CheckCircle, ChevronDown } from "lucide-react"
import type {Approval} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {  approveApproval, fetchApprovals, rejectApproval } from "@/lib/api"

export const Route = createFileRoute("/approvals")({ component: ApprovalsPage })

function formatCountdown(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function ApprovalsPage() {
  const [pending, setPending] = useState<Array<Approval>>([])
  const [historical, setHistorical] = useState<Array<Approval>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [now, setNow] = useState(Date.now())
  const [actionState, setActionState] = useState<{ [id: string]: { mode: "approve" | "reject"; reason: string } | undefined }>({})

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [pend, hist] = await Promise.all([
        fetchApprovals({ status: "pending" }),
        fetchApprovals({}),
      ])
      setPending(pend)
      setHistorical(hist.filter((a) => a.status !== "pending"))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (id: string, mode: "approve" | "reject") => {
    setActionState((prev) => ({ ...prev, [id]: { mode, reason: "" } }))
  }

  const confirmAction = async (id: string) => {
    const state = actionState[id]
    if (!state) return
    try {
      if (state.mode === "approve") {
        await approveApproval(id, state.reason)
      } else {
        await rejectApproval(id, state.reason)
      }
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setActionState((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }

  const sortedPending = [...pending].sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())

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

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-3 px-3 pb-3">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <CheckCircle className="size-6 text-primary" />
          <h2 className="text-sm font-medium">No pending approvals</h2>
          <p className="text-xs text-muted-foreground">All transactions are flowing through automatically.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedPending.map((item) => {
            const timeoutMs = new Date(item.expiresAt).getTime() - now
            const state = actionState[item.id]
            let args: Record<string, unknown> = {}
            try { args = JSON.parse(item.argsSnapshot) } catch {}
            return (
              <Card key={item.id} className="border-l-4 border-l-yellow-400">
                <CardContent className="flex flex-col gap-2 pt-3 px-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xl font-bold">${item.amount ? Number(item.amount).toLocaleString() : "—"}</div>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.currency || "USD"}</Badge>
                    </div>
                  </div>
                  <div className="font-mono text-xs">
                    {args.action as string || "unknown"}
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Created {new Date(item.createdAt).toLocaleString()}</span>
                    <span className={timeoutMs < 300000 ? "text-orange-400" : ""}>
                      Expires in {timeoutMs > 0 ? formatCountdown(timeoutMs) : "now"}
                    </span>
                  </div>
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
                      View full details <ChevronDown className="size-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="mt-1.5 rounded-md bg-accent p-2 text-[10px] font-mono overflow-auto">
                        {JSON.stringify(args, null, 2)}
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
                          setActionState((prev) => {
                            const existing = prev[item.id]
                            if (!existing) return prev
                            return {
                              ...prev,
                              [item.id]: { mode: existing.mode, reason: e.target.value },
                            }
                          })
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
                <TableHead className="h-7 text-xs">Approval ID</TableHead>
                <TableHead className="h-7 text-xs">Amount</TableHead>
                <TableHead className="h-7 text-xs">Status</TableHead>
                <TableHead className="h-7 text-xs">Reason</TableHead>
                <TableHead className="h-7 text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historical.slice(0, 20).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="py-1.5 font-mono text-[10px]">{d.id.slice(0, 12)}...</TableCell>
                  <TableCell className="py-1.5 text-xs">${d.amount ? Number(d.amount).toLocaleString() : "—"} {d.currency}</TableCell>
                  <TableCell className="py-1.5">
                    <DecisionBadge decision={d.status} />
                  </TableCell>
                  <TableCell className="py-1.5 text-[10px] text-muted-foreground">{d.rejectionReason || "—"}</TableCell>
                  <TableCell className="py-1.5 text-[10px] text-muted-foreground">{d.resolvedAt ? new Date(d.resolvedAt).toLocaleString() : "—"}</TableCell>
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
  if (decision === "approved" || decision === "executed") {
    return <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">APPROVED</Badge>
  }
  if (decision === "rejected") {
    return <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">REJECTED</Badge>
  }
  if (decision === "expired") {
    return <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">EXPIRED</Badge>
  }
  if (decision === "execution_failed") {
    return <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">FAILED</Badge>
  }
  return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0">PENDING</Badge>
}
