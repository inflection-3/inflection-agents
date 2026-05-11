import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
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
import { auditEntries } from "@/lib/data"
import { ChevronDown, Copy, Download, FileJson, FileSpreadsheet } from "lucide-react"

export const Route = createFileRoute("/audit-logs")({ component: AuditLogsPage })

function AuditLogsPage() {
  const [entries] = useState(auditEntries)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const [railFilter, setRailFilter] = useState("all")
  const [outcomeFilter, setOutcomeFilter] = useState("all")
  const [exportOpen, setExportOpen] = useState(false)

  const filtered = entries.filter((e) => {
    if (search && !e.agentName.includes(search) && !e.action.includes(search) && !(e.providerTxId || "").includes(search)) return false
    if (railFilter !== "all" && e.rail !== railFilter) return false
    if (outcomeFilter !== "all" && e.outcome !== outcomeFilter) return false
    return true
  })

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
                Export CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-sm">Export Audit Log</DialogTitle>
                <DialogDescription className="text-xs">Download audit entries as CSV or JSON.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { alert("CSV downloaded"); setExportOpen(false) }}>
                  <FileSpreadsheet className="size-3.5 mr-1" />
                  CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { alert("JSON downloaded"); setExportOpen(false) }}>
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
          placeholder="Search txId, agent, args..."
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
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="EXECUTED">EXECUTED</SelectItem>
            <SelectItem value="DENIED">DENIED</SelectItem>
            <SelectItem value="PENDING">PENDING</SelectItem>
            <SelectItem value="APPROVED">APPROVED</SelectItem>
            <SelectItem value="REJECTED">REJECTED</SelectItem>
          </SelectContent>
        </Select>
        {(search || railFilter !== "all" || outcomeFilter !== "all") && (
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setSearch(""); setRailFilter("all"); setOutcomeFilter("all") }}>
            Clear filters
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-7 text-xs w-10">#</TableHead>
              <TableHead className="h-7 text-xs">Timestamp</TableHead>
              <TableHead className="h-7 text-xs">Agent</TableHead>
              <TableHead className="h-7 text-xs">Rail</TableHead>
              <TableHead className="h-7 text-xs">Action</TableHead>
              <TableHead className="h-7 text-xs">Amount</TableHead>
              <TableHead className="h-7 text-xs">Decision</TableHead>
              <TableHead className="h-7 text-xs">Outcome</TableHead>
              <TableHead className="h-7 text-xs">Duration</TableHead>
              <TableHead className="h-7 text-xs">Tx ID</TableHead>
              <TableHead className="h-7 text-xs w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => (
              <>
                <TableRow key={entry.seq} className="cursor-pointer hover:bg-accent/50" onClick={() => setExpanded(expanded === entry.seq ? null : entry.seq)}>
                  <TableCell className="py-1.5 text-[10px] text-muted-foreground">{entry.seq}</TableCell>
                  <TableCell className="py-1.5 font-mono text-[10px] text-muted-foreground">{entry.timestamp}</TableCell>
                  <TableCell className="py-1.5 text-xs">{entry.agentName}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{entry.rail}</Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">{entry.action}</TableCell>
                  <TableCell className="py-1.5 text-xs text-right">${entry.amount.toLocaleString()}</TableCell>
                  <TableCell className="py-1.5">
                    <DecisionBadge decision={entry.policyDecision} />
                  </TableCell>
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
                    <ChevronDown className={`size-3 transition-transform ${expanded === entry.seq ? "rotate-180" : ""}`} />
                  </TableCell>
                </TableRow>
                {expanded === entry.seq && (
                  <TableRow key={`${entry.seq}-expanded`}>
                    <TableCell colSpan={11} className="p-0">
                      <div className="bg-accent p-2.5 mx-3 mb-2 rounded-md">
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">Entry hash: </span>
                            <span className="font-mono">{entry.entryHash}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Prev hash: </span>
                            <span className="font-mono">{entry.prevHash}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Chain: </span>
                            <span className="text-primary">✓ Valid</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Policy version: </span>
                            <span>{entry.policyVersion ?? "—"}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Showing 1–{filtered.length}/{filtered.length}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[10px]" disabled>←</Button>
          <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[10px] bg-accent">1</Button>
          <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-[10px]" disabled>→</Button>
        </div>
      </div>
    </div>
  )
}

function DecisionBadge({ decision }: { decision: string }) {
  const colors: Record<string, string> = {
    ALLOW: "bg-primary/20 text-primary",
    DENY: "bg-destructive/20 text-destructive",
    HOLD: "bg-yellow-500/20 text-yellow-400",
  }
  return <Badge className={`${colors[decision] || "bg-muted text-muted-foreground"} text-[10px] px-1.5 py-0`}>{decision}</Badge>
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const colors: Record<string, string> = {
    EXECUTED: "bg-primary/20 text-primary",
    DENIED: "bg-destructive/20 text-destructive",
    PENDING: "bg-yellow-500/20 text-yellow-400",
    APPROVED: "bg-primary/20 text-primary",
    REJECTED: "bg-destructive/20 text-destructive",
    TIMEOUT: "bg-muted text-muted-foreground",
  }
  return <Badge className={`${colors[outcome] || "bg-muted text-muted-foreground"} text-[10px] px-1.5 py-0`}>{outcome}</Badge>
}
