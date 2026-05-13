import { createFileRoute } from "@tanstack/react-router"
import {
  CheckCircle2,
  Copy,
  Download,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/audit-logs")({
  component: AuditLogsPage,
})

const events = [
  {
    time: "2026-05-14T14:32:01.234Z",
    type: "execution.started",
    outcome: "ALLOW",
    executionId: "exec_8f3a2b",
    actor: "user_8291",
    desc: "Execution started for Balance Alert",
    hash: "a3f2c9d1e4b7",
  },
  {
    time: "2026-05-14T14:32:01.246Z",
    type: "node.started",
    outcome: "ALLOW",
    executionId: "exec_8f3a2b",
    actor: "system",
    desc: "Node 'Input' started",
    hash: "b8e1d4f7a2c5",
  },
  {
    time: "2026-05-14T14:32:02.086Z",
    type: "node.completed",
    outcome: "ALLOW",
    executionId: "exec_8f3a2b",
    actor: "system",
    desc: "Node 'Input' completed",
    hash: "c4a2b9e3d1f6",
  },
  {
    time: "2026-05-14T14:32:02.940Z",
    type: "connector.accessed",
    outcome: "ALLOW",
    executionId: "exec_8f3a2b",
    actor: "system",
    desc: "Plaid credential accessed for getBalance",
    hash: "d7f3c6a1b4e2",
  },
  {
    time: "2026-05-14T14:32:05.440Z",
    type: "node.completed",
    outcome: "ALLOW",
    executionId: "exec_8f3a2b",
    actor: "system",
    desc: "Node 'LLM' completed — 170 tokens",
    hash: "e2b5d8f4c7a1",
  },
  {
    time: "2026-05-14T14:32:05.450Z",
    type: "approval.requested",
    outcome: "HOLD",
    executionId: "exec_8f3a2b",
    actor: "user_8291",
    desc: "Approval requested for sendEmail action",
    hash: "f6c1e4a7d2b5",
  },
  {
    time: "2026-05-14T14:15:00.000Z",
    type: "kill_switch.toggled",
    outcome: "ALLOW",
    executionId: null,
    actor: "jane@acmecorp.com",
    desc: "Kill switch turned OFF",
    hash: "a8d3b2c5e1f4",
  },
  {
    time: "2026-05-14T13:45:22.100Z",
    type: "execution.completed",
    outcome: "ALLOW",
    executionId: "exec_7d2c1b",
    actor: "scheduled",
    desc: "Execution completed for Scheduled Report",
    hash: "b4e7c1d9f3a6",
  },
  {
    time: "2026-05-14T13:45:21.890Z",
    type: "guardrail.denied",
    outcome: "DENY",
    executionId: "exec_6c1b0a",
    actor: "system",
    desc: "Action stripe.createRefund blocked by denylist",
    hash: "c2f5a8b6d1e3",
  },
  {
    time: "2026-05-14T13:30:10.455Z",
    type: "node.failed",
    outcome: "DENY",
    executionId: "exec_5b0a9z",
    actor: "system",
    desc: "Node 'HTTP Request' failed — timeout after 30s",
    hash: "d1a4c7e2f5b8",
  },
  {
    time: "2026-05-14T13:12:45.000Z",
    type: "connector.accessed",
    outcome: "ALLOW",
    executionId: "exec_4a9z8y",
    actor: "system",
    desc: "Stripe credential accessed for createCharge",
    hash: "e3b6d9f2c5a1",
  },
  {
    time: "2026-05-14T13:12:43.200Z",
    type: "approval.resolved",
    outcome: "ALLOW",
    executionId: "exec_3z8y7x",
    actor: "jane@acmecorp.com",
    desc: "Approval resolved — Approved by Jane Doe",
    hash: "f5c8b1e4a7d2",
  },
]

const eventIcons: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "execution.started": CheckCircle2,
  "execution.completed": CheckCircle2,
  "node.started": CheckCircle2,
  "node.completed": CheckCircle2,
  "node.failed": ShieldAlert,
  "connector.accessed": ShieldCheck,
  "guardrail.denied": ShieldOff,
  "approval.requested": ShieldCheck,
  "approval.resolved": ShieldCheck,
  "kill_switch.toggled": ShieldOff,
}

const outcomeBadge = (o: string) => {
  const map: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline"
      label: string
    }
  > = {
    ALLOW: { variant: "default", label: "ALLOW" },
    DENY: { variant: "destructive", label: "DENY" },
    HOLD: { variant: "secondary", label: "HOLD" },
  }
  const b = map[o] ?? { variant: "outline" as const, label: o }
  return (
    <Badge variant={b.variant} className="text-[10px]">
      {b.label}
    </Badge>
  )
}

export default function AuditLogsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Immutable, hash-chained compliance record.
          </p>
        </div>
        <Button size="sm" variant="outline">
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>

      <Card size="sm">
        <CardHeader className="flex-row flex-wrap items-center gap-2 pb-1">
          <Select defaultValue="all">
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="execution">Execution</SelectItem>
              <SelectItem value="guardrail">Guardrail</SelectItem>
              <SelectItem value="approval">Approval</SelectItem>
              <SelectItem value="connector">Connector</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="allow">ALLOW</SelectItem>
              <SelectItem value="deny">DENY</SelectItem>
              <SelectItem value="hold">HOLD</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Execution ID..."
              className="h-7 w-40 pl-7 text-xs"
            />
          </div>
          <div className="flex-1" />
          <span className="text-[11px] text-muted-foreground">
            Showing 12 of 1,847 events
          </span>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="w-[70px]">Outcome</TableHead>
                <TableHead>Execution</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Hash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e, i) => {
                const Icon = eventIcons[e.type] ?? CheckCircle2
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {new Date(e.time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Icon className="size-3 text-muted-foreground" />
                        <span className="font-mono text-xs">{e.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{outcomeBadge(e.outcome)}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {e.executionId ? e.executionId.slice(0, 12) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {e.actor}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs">
                      {e.desc}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {e.hash.slice(0, 8)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-5"
                        >
                          <Copy className="size-2.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
