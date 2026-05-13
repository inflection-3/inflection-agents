import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  Play,
  Plug,
  Plus,
  ShieldOff,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"


export const Route = createFileRoute("/")({ component: HomePage })

const stats = [
  {
    label: "Total Executions",
    value: "12,847",
    delta: "+12%",
    deltaUp: true,
    icon: Play,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Success Rate",
    value: "98.4%",
    sub: "42 failed",
    delta: "+0.8%",
    deltaUp: true,
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Pending Approvals",
    value: "3",
    sub: "2 overdue",
    delta: "-1",
    deltaUp: false,
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    label: "Active Agents",
    value: "156",
    delta: "+23",
    deltaUp: true,
    icon: Bot,
    color: "text-violet-600 dark:text-violet-400",
  },
  {
    label: "Est. LLM Cost",
    value: "$342.18",
    sub: "last 7 days",
    delta: "+$48.20",
    deltaUp: true,
    icon: DollarSign,
    color: "text-rose-600 dark:text-rose-400",
  },
]

const sparklineData = [
  { day: "Mon", completed: 182, failed: 4, cancelled: 2 },
  { day: "Tue", completed: 234, failed: 3, cancelled: 5 },
  { day: "Wed", completed: 198, failed: 7, cancelled: 3 },
  { day: "Thu", completed: 256, failed: 2, cancelled: 1 },
  { day: "Fri", completed: 212, failed: 5, cancelled: 4 },
  { day: "Sat", completed: 145, failed: 1, cancelled: 0 },
  { day: "Sun", completed: 168, failed: 3, cancelled: 2 },
]

const maxExec = Math.max(
  ...sparklineData.map((d) => d.completed + d.failed + d.cancelled)
)

const recentActivity = [
  {
    type: "execution",
    icon: Play,
    iconColor: "text-blue-500",
    desc: "Transaction Summary executed successfully",
    user: "api@acmecorp.com",
    time: "2 min ago",
    flow: "Transaction Summary",
    status: "completed",
  },
  {
    type: "approval",
    icon: Clock,
    iconColor: "text-amber-500",
    desc: "Approval requested for $1,250.00 charge",
    user: "user_8291",
    time: "8 min ago",
    flow: "Payment Approval",
    status: "pending",
  },
  {
    type: "publish",
    icon: Zap,
    iconColor: "text-emerald-500",
    desc: "Balance Alert v3 published to production",
    user: "jane@acmecorp.com",
    time: "45 min ago",
    flow: "Balance Alert",
    status: "published",
  },
  {
    type: "connector",
    icon: Plug,
    iconColor: "text-violet-500",
    desc: "Stripe connector credentials updated",
    user: "john@acmecorp.com",
    time: "2 hours ago",
    flow: null,
    status: "updated",
  },
  {
    type: "guardrail",
    icon: ShieldOff,
    iconColor: "text-red-500",
    desc: "Kill switch toggled OFF",
    user: "jane@acmecorp.com",
    time: "3 hours ago",
    flow: null,
    status: "toggled",
  },
  {
    type: "execution",
    icon: Play,
    iconColor: "text-blue-500",
    desc: "Custom Connector Query failed — timeout",
    user: "api@acmecorp.com",
    time: "5 hours ago",
    flow: "Custom Connector Query",
    status: "failed",
  },
  {
    type: "invite",
    icon: UserPlus,
    iconColor: "text-indigo-500",
    desc: "alice@acmecorp.com invited as Editor",
    user: "jane@acmecorp.com",
    time: "6 hours ago",
    flow: null,
    status: "invited",
  },
  {
    type: "execution",
    icon: Play,
    iconColor: "text-blue-500",
    desc: "Balance Alert executed successfully",
    user: "scheduled",
    time: "6 hours ago",
    flow: "Balance Alert",
    status: "completed",
  },
]

const activityIcons: Record<string, typeof Play> = {
  execution: Play,
  approval: Clock,
  publish: Zap,
  connector: Plug,
  guardrail: ShieldOff,
  invite: UserPlus,
}

const statusBadge = (status: string) => {
  const map: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline"
      label: string
    }
  > = {
    completed: { variant: "default", label: "Completed" },
    failed: { variant: "destructive", label: "Failed" },
    pending: { variant: "secondary", label: "Pending" },
    published: { variant: "default", label: "Published" },
    updated: { variant: "outline", label: "Updated" },
    toggled: { variant: "outline", label: "Toggled" },
    invited: { variant: "secondary", label: "Invited" },
  }
  const b = map[status] ?? { variant: "outline" as const, label: status }
  return <Badge variant={b.variant}>{b.label}</Badge>
}

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Home</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, Jane. Here&apos;s what&apos;s happening.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" asChild>
            <Link to="/flows">
              <Plus className="size-3.5" /> New Flow
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/connectors">
              <Plug className="size-3.5" /> Add Connector
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} size="sm">
            <CardContent className="flex flex-col gap-1 px-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {stat.label}
                </span>
                <stat.icon className={`size-3.5 ${stat.color}`} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tracking-tight">
                  {stat.value}
                </span>
                <span
                  className={`flex items-center text-xs ${stat.deltaUp ? "text-emerald-600" : "text-red-600"}`}
                >
                  {stat.deltaUp ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {stat.delta}
                </span>
              </div>
              {stat.sub && (
                <span className="text-[11px] text-muted-foreground">
                  {stat.sub}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Executions (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <div className="flex h-28 items-end gap-1.5">
              {sparklineData.map((d) => {
                const total = d.completed + d.failed + d.cancelled
                const hPct = (total / maxExec) * 100
                return (
                  <div
                    key={d.day}
                    className="flex flex-1 flex-col justify-end gap-0.5"
                  >
                    <div
                      className="flex flex-col gap-px"
                      style={{ height: `${hPct}%` }}
                    >
                      <div
                        className="w-full rounded-t-sm bg-emerald-500/70"
                        style={{ height: `${(d.completed / total) * 100}%` }}
                      />
                      <div
                        className="w-full bg-red-500/70"
                        style={{ height: `${(d.failed / total) * 100}%` }}
                      />
                      <div
                        className="w-full rounded-b-sm bg-gray-400/70"
                        style={{ height: `${(d.cancelled / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-center text-[10px] text-muted-foreground">
                      {d.day}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-emerald-500/70" />{" "}
                Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-red-500/70" /> Failed
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-sm bg-gray-400/70" /> Cancelled
              </span>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Clock className="size-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Payment Approval</p>
                <p className="text-xs text-muted-foreground">
                  $1,250.00 charge · 8m ago
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Clock className="size-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Invoice Approval</p>
                <p className="text-xs text-muted-foreground">
                  $340.50 refund · 45m ago
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/approvals">
                Review all <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader className="flex-row items-center justify-between pb-1">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
          <Button variant="ghost" size="xs" asChild>
            <Link to="/audit-logs">View audit log</Link>
          </Button>
        </CardHeader>
        <CardContent className="px-3">
          <div className="divide-y">
            {recentActivity.map((item, i) => {
              const Icon = activityIcons[item.type] ?? Play
              return (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ${item.iconColor}`}
                  >
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.desc}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.user} · {item.time}
                    </p>
                  </div>
                  {statusBadge(item.status)}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
