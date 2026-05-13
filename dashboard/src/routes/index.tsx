import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Activity, Bot, Clock, DollarSign } from "lucide-react"
import type {Agent, Approval, AuditLog, Connector} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import {     fetchAgents, fetchApprovals, fetchAuditLogs, fetchConnectors } from "@/lib/api"

export const Route = createFileRoute("/")({ component: OverviewPage })

function OverviewPage() {
  const [agents, setAgents] = useState<Array<Agent>>([])
  const [, setConnectors] = useState<Array<Connector>>([])
  const [pendingApprovals, setPendingApprovals] = useState<Array<Approval>>([])
  const [recentLogs, setRecentLogs] = useState<Array<AuditLog>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [ags, cons, approvals, logs] = await Promise.all([
        fetchAgents(),
        fetchConnectors(),
        fetchApprovals({ status: "pending" }),
        fetchAuditLogs({ limit: 5 }),
      ])
      setAgents(ags.filter((a) => a.status !== "deleted"))
      setConnectors(cons)
      setPendingApprovals(approvals)
      setRecentLogs(logs.items)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const activeAgents = agents.filter((a) => a.status === "active").length
  const totalSpend = recentLogs
    .filter((l) => l.outcome === "ALLOW" && l.amount)
    .reduce((sum, l) => sum + Number(l.amount), 0)

  const statCards = [
    { label: "Total Spend (recent)", value: `$${totalSpend.toLocaleString()}`, delta: "From last 5 transactions", icon: DollarSign },
    { label: "Transaction Count", value: String(recentLogs.length), delta: "Recent activity", icon: Activity },
    { label: "Pending Approvals", value: String(pendingApprovals.length), delta: "Needs attention", icon: Clock },
    { label: "Active Agents", value: String(activeAgents), delta: `of ${agents.length} total`, icon: Bot },
  ]

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Overview</h1>
        <span className="text-xs text-muted-foreground">Real-time</span>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border border-border hover:bg-accent transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="size-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <div className="text-lg font-bold">{stat.value}</div>
              <p className="text-[10px] text-muted-foreground">{stat.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-semibold">Recent Transactions</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 text-xs">Agent</TableHead>
                <TableHead className="h-7 text-xs">Rail</TableHead>
                <TableHead className="h-7 text-xs">Action</TableHead>
                <TableHead className="h-7 text-xs">Amount</TableHead>
                <TableHead className="h-7 text-xs">Status</TableHead>
                <TableHead className="h-7 text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground py-3">Loading...</TableCell>
                </TableRow>
              ) : recentLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground py-3">No recent transactions</TableCell>
                </TableRow>
              ) : (
                recentLogs.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="py-1.5 text-xs font-medium">{tx.agentId.slice(0, 8)}...</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tx.rail}</Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">{tx.action}</TableCell>
                    <TableCell className="py-1.5 text-xs">{tx.amount ? `$${Number(tx.amount).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="py-1.5">
                      <StatusBadge status={tx.outcome} />
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pending Approvals</h2>
          <Link to="/approvals" className="text-xs text-primary hover:underline">
            View all ({pendingApprovals.length} pending)
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {loading ? (
            <div className="text-xs text-muted-foreground py-4">Loading...</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4">No pending approvals</div>
          ) : (
            pendingApprovals.slice(0, 3).map((item) => (
              <Card key={item.id} className="border-l-4 border-l-yellow-400">
                <CardContent className="flex flex-col gap-2 pt-3 px-3 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{item.agentId.slice(0, 8)}...</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.currency || "USD"}</Badge>
                  </div>
                  <div className="text-xl font-bold">${item.amount ? Number(item.amount).toLocaleString() : "—"}</div>
                  <p className="text-[10px] text-muted-foreground">Waiting for approval</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="flex-1 h-6 text-xs" onClick={() => window.location.href = "/approvals"}>Review</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ALLOW") {
    return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">ALLOWED</Badge>
  }
  if (status === "HOLD") {
    return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0">HELD</Badge>
  }
  return <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">DENIED</Badge>
}
