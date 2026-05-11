import { createFileRoute, Link } from "@tanstack/react-router"
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
import { recentTransactions, pendingApprovals } from "@/lib/data"
import { DollarSign, Activity, Clock, Bot } from "lucide-react"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"

export const Route = createFileRoute("/")({ component: OverviewPage })

function OverviewPage() {
  const statCards = [
    { label: "Total Spend (30d)", value: "$48,320", delta: "+12% vs last month", icon: DollarSign },
    { label: "Transaction Count", value: "1,204", delta: "+8% vs last month", icon: Activity },
    { label: "Pending Approvals", value: "3", delta: "Needs attention", icon: Clock },
    { label: "Active Agents", value: "2", delta: "of 3 total", icon: Bot },
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
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>

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
              {recentTransactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="py-1.5 text-xs font-medium">{tx.agent}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tx.rail}</Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">{tx.action}</TableCell>
                  <TableCell className="py-1.5 text-xs">${tx.amount.toLocaleString()}</TableCell>
                  <TableCell className="py-1.5">
                    <StatusBadge status={tx.status} />
                  </TableCell>
                  <TableCell className="py-1.5 text-xs text-muted-foreground">{tx.ts}</TableCell>
                </TableRow>
              ))}
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
          {pendingApprovals.slice(0, 3).map((item) => (
            <Card key={item.id} className="border-l-4 border-l-yellow-400">
              <CardContent className="flex flex-col gap-2 pt-3 px-3 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{item.agent}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.rail}</Badge>
                </div>
                <div className="text-xl font-bold">${item.amount.toLocaleString()}</div>
                <p className="text-[10px] text-muted-foreground">Waiting {item.waitingMin} min</p>
                <div className="flex gap-1.5">
                  <Button size="sm" className="flex-1 h-6 text-xs">Approve</Button>
                  <Button size="sm" variant="outline" className="flex-1 h-6 text-xs">Reject</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ALLOWED") {
    return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">ALLOWED</Badge>
  }
  if (status === "HELD") {
    return <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] px-1.5 py-0">HELD</Badge>
  }
  return <Badge className="bg-destructive/20 text-destructive text-[10px] px-1.5 py-0">DENIED</Badge>
}
