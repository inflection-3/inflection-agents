import { createFileRoute } from "@tanstack/react-router"
import { CheckCircle2, Clock, DollarSign, Play, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage })

const stats = [
  {
    label: "Total Executions",
    value: "12,847",
    icon: Play,
    color: "text-blue-600 dark:text-blue-400",
    trend: "+12%",
  },
  {
    label: "Success Rate",
    value: "98.4%",
    sub: "1,987 failed",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    trend: null,
  },
  {
    label: "Avg Duration",
    value: "1.2s",
    sub: "median",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    trend: null,
  },
  {
    label: "Est. Cost",
    value: "$1,842",
    sub: "LLM cost",
    icon: DollarSign,
    color: "text-rose-600 dark:text-rose-400",
    trend: "+$210",
  },
]

const volumeData = [
  { date: "Apr 14", completed: 384, failed: 12, cancelled: 8 },
  { date: "Apr 15", completed: 412, failed: 8, cancelled: 5 },
  { date: "Apr 16", completed: 398, failed: 15, cancelled: 10 },
  { date: "Apr 17", completed: 456, failed: 6, cancelled: 4 },
  { date: "Apr 18", completed: 389, failed: 18, cancelled: 7 },
  { date: "Apr 19", completed: 345, failed: 4, cancelled: 2 },
  { date: "Apr 20", completed: 298, failed: 9, cancelled: 3 },
]
const maxVol = Math.max(
  ...volumeData.map((d) => d.completed + d.failed + d.cancelled)
)

const flowsPerf = [
  {
    name: "Balance Alert",
    executions: 2847,
    successRate: 99.2,
    avgMs: 850,
    p95Ms: 2100,
    failures: 23,
    cost: "$124.50",
  },
  {
    name: "Transaction Summary",
    executions: 2145,
    successRate: 97.8,
    avgMs: 1240,
    p95Ms: 3400,
    failures: 47,
    cost: "$312.80",
  },
  {
    name: "Payment Approval",
    executions: 842,
    successRate: 98.9,
    avgMs: 3200,
    p95Ms: 8900,
    failures: 9,
    cost: "$89.20",
  },
  {
    name: "Scheduled Report",
    executions: 1568,
    successRate: 98.2,
    avgMs: 980,
    p95Ms: 2800,
    failures: 28,
    cost: "$156.40",
  },
  {
    name: "Custom Connector Query",
    executions: 423,
    successRate: 94.6,
    avgMs: 2100,
    p95Ms: 6500,
    failures: 23,
    cost: "$67.30",
  },
]

const errors = [
  { type: "Node Timeout", count: 342, pct: 38 },
  { type: "Connector Error", count: 231, pct: 26 },
  { type: "Guardrail Denied", count: 145, pct: 16 },
  { type: "Budget Exceeded", count: 89, pct: 10 },
  { type: "User Cancelled", count: 87, pct: 10 },
]
const maxError = errors[0]?.count ?? 1

export default function AnalyticsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Execution volume, performance, and cost.
          </p>
        </div>
        <Select defaultValue="30d">
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue placeholder="Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="flex flex-col gap-1 px-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`size-3.5 ${s.color}`} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tracking-tight">
                  {s.value}
                </span>
                {s.trend && (
                  <span className="flex items-center text-xs text-emerald-600">
                    <TrendingUp className="size-3" />
                    {s.trend}
                  </span>
                )}
              </div>
              {s.sub && (
                <span className="text-[11px] text-muted-foreground">
                  {s.sub}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card size="sm" className="lg:col-span-3">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Execution Volume</CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <div className="flex h-40 items-end gap-3">
              {volumeData.map((d) => (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  <div className="flex w-full flex-1 flex-col justify-end gap-px">
                    <div
                      className="flex flex-col justify-end gap-0.5"
                      style={{
                        height: `${((d.completed + d.failed + d.cancelled) / maxVol) * 100}%`,
                      }}
                    >
                      <div
                        className="w-full rounded-t-sm bg-emerald-500/60"
                        style={{
                          height: `${(d.completed / (d.completed + d.failed + d.cancelled)) * 100}%`,
                        }}
                      />
                      <div
                        className="w-full bg-red-500/60"
                        style={{
                          height: `${(d.failed / (d.completed + d.failed + d.cancelled)) * 100}%`,
                        }}
                      />
                      <div
                        className="w-full rounded-b-sm bg-gray-400/60"
                        style={{
                          height: `${(d.cancelled / (d.completed + d.failed + d.cancelled)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {d.date}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-emerald-500/60" />{" "}
                Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-red-500/60" /> Failed
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-gray-400/60" /> Cancelled
              </span>
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Error Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <div className="flex flex-col gap-2">
              {errors.map((e) => (
                <div key={e.type} className="flex items-center gap-2">
                  <span className="w-28 truncate text-xs text-muted-foreground">
                    {e.type}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-destructive/70"
                      style={{ width: `${(e.count / maxError) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                    {e.count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Flow Performance</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flow</TableHead>
                  <TableHead className="text-right">Exec</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flowsPerf.map((f) => (
                  <TableRow key={f.name}>
                    <TableCell className="text-xs font-medium">
                      {f.name}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {f.executions}
                    </TableCell>
                    <TableCell
                      className={`text-right text-xs ${f.successRate >= 95 ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {f.successRate}%
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {f.avgMs}ms
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {f.cost}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Approval Metrics</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Avg Resolution Time
              </span>
              <span className="text-xs font-medium">2.4 hours</span>
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg border p-2">
                <span className="text-xs font-medium text-emerald-600">
                  72%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Approved
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg border p-2">
                <span className="text-xs font-medium text-red-600">18%</span>
                <span className="text-[10px] text-muted-foreground">
                  Rejected
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center gap-1 rounded-lg border p-2">
                <span className="text-xs font-medium text-muted-foreground">
                  10%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Expired
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
