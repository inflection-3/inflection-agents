import { Link, createFileRoute } from "@tanstack/react-router"
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts"
import { CheckCircle, DollarSign, TrendingUp } from "lucide-react"
import type {ChartConfig} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {  ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { dailySpend, topActions, txByOutcome, txByRail } from "@/lib/data"

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage })

const chartConfig: ChartConfig = {
  executed: { label: "Executed", color: "#BAFC00" },
  held: { label: "Held/Pending", color: "#EAB308" },
  stripe: { label: "Stripe", color: "#635BFF" },
  circle: { label: "Circle", color: "#0066FF" },
  x402: { label: "x402", color: "#BAFC00" },
  ALLOWED: { label: "Allowed" },
  HELD: { label: "Held" },
  DENIED: { label: "Denied" },
}

const railColors = ["#635BFF", "#0066FF", "#BAFC00"]
const outcomeColors = ["#BAFC00", "#EAB308", "#ef4444"]

function AnalyticsPage() {
  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <div className="flex gap-1.5">
          <Select defaultValue="all">
            <SelectTrigger className="h-6 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="vendor">vendor-pay-agent</SelectItem>
              <SelectItem value="invoice">invoice-bot</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="30d">
            <SelectTrigger className="h-6 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md bg-accent border border-border px-3 py-2 text-xs text-muted-foreground">
        📊 Analytics is coming in v2. This preview shows sample data.
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { label: "Total Spend (30d)", value: "$48,320", icon: DollarSign },
          { label: "Avg Transaction", value: "$401", icon: TrendingUp },
          { label: "Allow Rate", value: "94.2%", icon: CheckCircle },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3">
              <CardTitle className="text-[10px] font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="size-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-3 pb-2">
              <div className="text-lg font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-xs font-semibold">Daily Spend</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <AreaChart data={dailySpend}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="executed" stackId="1" stroke="#BAFC00" fill="#BAFC00" fillOpacity={0.3} />
              <Area type="monotone" dataKey="held" stackId="1" stroke="#EAB308" fill="#EAB308" fillOpacity={0.3} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-semibold">Tx by Rail</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2 flex items-center justify-center">
            <ChartContainer config={chartConfig} className="h-40 w-40">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={txByRail} dataKey="count" nameKey="rail" cx="50%" cy="50%" innerRadius={30} outerRadius={55}>
                  {txByRail.map((_, i) => (
                    <Cell key={i} fill={railColors[i]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-2 px-3">
            <CardTitle className="text-xs font-semibold">Tx by Outcome</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2">
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <BarChart data={txByOutcome} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="outcome" tick={{ fontSize: 9 }} width={60} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {txByOutcome.map((_, i) => (
                    <Cell key={i} fill={outcomeColors[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-1 pt-2 px-3">
          <CardTitle className="text-xs font-semibold">Top Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-6 text-xs">Action</TableHead>
                <TableHead className="h-6 text-xs">Count</TableHead>
                <TableHead className="h-6 text-xs">Total $</TableHead>
                <TableHead className="h-6 text-xs">Allow %</TableHead>
                <TableHead className="h-6 text-xs">Avg ms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topActions.map((a) => (
                <TableRow key={a.action}>
                  <TableCell className="py-1 text-xs font-medium">{a.action}</TableCell>
                  <TableCell className="py-1 text-xs">{a.count}</TableCell>
                  <TableCell className="py-1 text-xs">${a.totalUsd.toLocaleString()}</TableCell>
                  <TableCell className="py-1 text-xs">{a.allowRate}</TableCell>
                  <TableCell className="py-1 text-xs text-muted-foreground">{a.avgMs}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
