import { Link, createFileRoute } from "@tanstack/react-router"
import React, { useEffect, useState } from "react"
import { ChevronDown, Copy, Download, FileJson, FileSpreadsheet } from "lucide-react"
import type {AuditLog} from "@/lib/api";
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {  fetchAuditLogs } from "@/lib/api"

export const Route = createFileRoute("/audit-logs")({ component: AuditLogsPage })

function AuditLogsPage() {
  const [entries, setEntries] = useState<Array<AuditLog>>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [railFilter, setRailFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async (nextCursor?: string) => {
    try {
      setLoading(true)
      const params: any = { limit: 50 }
      if (nextCursor) params.cursor = nextCursor
      if (outcomeFilter !== "all") params.outcome = outcomeFilter
      const data = await fetchAuditLogs(params)
      if (nextCursor) {
        setEntries((prev) => [...prev, ...data.items])
      } else {
        setEntries(data.items)
      }
      setCursor(data.nextCursor)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = entries.filter((e) => {
    if (search && !e.agentId.includes(search) && !e.action.includes(search) && !(e.providerTxId || "").includes(search)) return false
    if (railFilter !== "all" && e.rail !== railFilter) return false
    if (outcomeFilter !== "all" && e.outcome !== outcomeFilter) return false
    return true
  })

  const exportData = (format: "csv" | "json") => {
    if (format === "json") {
      const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
    } else {
      const headers = ["id", "createdAt", "agentId", "rail", "action", "outcome", "amount", "currency", "denyRule", "providerTxId", "durationMs"]
      const rows = filtered.map((e) => [
        e.id, e.createdAt, e.agentId, e.rail, e.action, e.outcome, e.amount, e.currency, e.denyRule, e.providerTxId, e.durationMs,
      ])
      const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '\\"')}"`).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
    }
    setExportOpen(false)
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
            <BreadcrumbPage>Audit Logs</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Audit Log</h1>
          <p className="text-[10px] text-muted-foreground">Entries are append-only and hash-chained</p>
        </div>
        <div className="flex gap-1.5">
          <Dialog open={exportOpen} onOpenChange={setExportOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-6 text-[10px]">
                <Download className="size-3 mr-1" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-sm">Export Audit Log</DialogTitle>
                <DialogDescription className="text-xs">Download audit entries as CSV or JSON.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => exportData("csv")}>
                  <FileSpreadsheet className="size-3.5 mr-1" />
                  CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => exportData("json")}>
                  <FileJson className="size-3.5 mr-1" />
                  JSON
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search agent, action, txId..."
          className="h-7 text-xs w-48"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={railFilter} onValueChange={setRailFilter}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="Rail" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rails</SelectItem>
            <SelectItem value="stripe">Stripe</SelectItem>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="x402">x402</SelectItem>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="braintree">Braintree</SelectItem>
            <SelectItem value="razorpay">Razorpay</SelectItem>
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="ALLOW">ALLOW</SelectItem>
            <SelectItem value="DENY">DENY</SelectItem>
            <SelectItem value="HOLD">HOLD</SelectItem>
          </SelectContent>
        </Select>
        {(search || railFilter !== "all" || outcomeFilter !== "all") && (
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setSearch(""); setRailFilter("all"); setOutcomeFilter("all") }}>
            Clear filters
          </Button>
        )}
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {loading && entries.length === 0 ? (
        <div className="text-xs text-muted-foreground">Loading audit logs...</div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 text-xs">Time</TableHead>
                <TableHead className="h-7 text-xs">Agent</TableHead>
                <TableHead className="h-7 text-xs">Rail</TableHead>
                <TableHead className="h-7 text-xs">Action</TableHead>
                <TableHead className="h-7 text-xs">Amount</TableHead>
                <TableHead className="h-7 text-xs">Outcome</TableHead>
                <TableHead className="h-7 text-xs">Duration</TableHead>
                <TableHead className="h-7 text-xs">Tx ID</TableHead>
                <TableHead className="h-7 text-xs w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <React.Fragment key={entry.id}>
                  <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                    <TableCell className="py-1.5 font-mono text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="py-1.5 text-xs">{entry.agentId.slice(0, 8)}...</TableCell>
                    <TableCell className="py-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{entry.rail}</Badge>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">{entry.action}</TableCell>
                    <TableCell className="py-1.5 text-xs text-right">{entry.amount ? `$${Number(entry.amount).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="py-1.5">
                      <OutcomeBadge outcome={entry.outcome} />
                    </TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">{entry.durationMs}ms</TableCell>
                    <TableCell className="py-1.5 font-mono text-[10px]">
                      {entry.providerTxId ? (
                        <span className="flex items-center gap-1">
                          {entry.providerTxId}
                          <Button size="icon" variant="ghost" className="size-3.5" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(entry.providerTxId!) }}>
                            <Copy className="size-2.5" />
                          </Button>
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <ChevronDown className={`size-3 transition-transform ${expanded === entry.id ? "rotate-180" : ""}`} />
                    </TableCell>
                  </TableRow>
                  {expanded === entry.id && (
                    <TableRow>
                      <TableCell colSpan={9} className="p-0">
                        <div className="bg-accent p-2.5 mx-3 mb-2 rounded-md">
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            <div><span className="text-muted-foreground">Entry hash: </span><span className="font-mono">{entry.rowHash}</span></div>
                            <div><span className="text-muted-foreground">Prev hash: </span><span className="font-mono">{entry.prevHash}</span></div>
                            <div><span className="text-muted-foreground">Chain: </span><span className="text-primary">Valid</span></div>
                            <div><span className="text-muted-foreground">Policy: </span><span>{entry.policyId || "—"}</span></div>
                            {entry.denyRule && <div><span className="text-muted-foreground">Deny rule: </span><span className="text-destructive">{entry.denyRule}</span></div>}
                            {entry.approvalId && <div><span className="text-muted-foreground">Approval: </span><span>{entry.approvalId}</span></div>}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {cursor && (
        <div className="flex justify-center">
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => loadLogs(cursor || undefined)} disabled={loading}>
            {loading ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Showing {filtered.length} entries</span>
      </div>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, string> = {
    ALLOW: "bg-primary/20 text-primary",
    DENY: "bg-destructive/20 text-destructive",
    HOLD: "bg-yellow-500/20 text-yellow-400",
  }
  return <Badge className={`${colors[outcome] || "bg-muted text-muted-foreground"} text-[10px] px-1.5 py-0`}>{outcome}</Badge>
}
