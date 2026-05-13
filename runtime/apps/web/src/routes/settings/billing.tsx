import { createFileRoute } from "@tanstack/react-router"
import { CalendarDays, CreditCard, Download, Zap } from "lucide-react"
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

export const Route = createFileRoute("/settings/billing")({
  component: BillingPage,
})

const usageData = [
  {
    flow: "Balance Alert",
    executions: "2,847",
    tokens: "142k",
    cost: "$124.50",
  },
  {
    flow: "Transaction Summary",
    executions: "2,145",
    tokens: "98k",
    cost: "$312.80",
  },
  {
    flow: "Payment Approval",
    executions: "842",
    tokens: "45k",
    cost: "$89.20",
  },
  {
    flow: "Scheduled Report",
    executions: "1,568",
    tokens: "67k",
    cost: "$156.40",
  },
]

const invoices = [
  {
    date: "May 1, 2026",
    period: "Apr 2026",
    amount: "$842.30",
    status: "Paid",
  },
  {
    date: "Apr 1, 2026",
    period: "Mar 2026",
    amount: "$798.50",
    status: "Paid",
  },
  {
    date: "Mar 1, 2026",
    period: "Feb 2026",
    amount: "$654.20",
    status: "Paid",
  },
  {
    date: "Feb 1, 2026",
    period: "Jan 2026",
    amount: "$512.80",
    status: "Paid",
  },
]

export default function BillingPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Usage, invoices, and payment method.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Current Period</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  Executions
                </span>
                <span className="text-xs font-medium">12,847 / 50,000</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-2 w-[26%] rounded-full bg-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground">
                26% used
              </span>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overage</span>
                <span className="font-medium">$0.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next invoice</span>
                <span className="font-medium">Jun 1, 2026 ~$842</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Payment Method</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Visa ending 4242</span>
              <Badge variant="secondary" className="text-[10px]">
                Exp 12/2027
              </Badge>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
              <span>billing@acmecorp.com</span>
              <span>123 Main St, San Francisco, CA 94105</span>
            </div>
            <Button variant="outline" size="sm" className="w-fit">
              Update Payment Method
            </Button>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Quick Stats</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Plan</span>
              <Badge className="text-[10px]">Pro 50k exec/mo</Badge>
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base</span>
                <span className="font-medium">$499/mo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overage</span>
                <span className="font-medium">$0.02/execution</span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-fit">
              Change Plan
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Usage Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flow</TableHead>
                <TableHead className="text-right">Executions</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageData.map((row) => (
                <TableRow key={row.flow}>
                  <TableCell className="text-xs font-medium">
                    {row.flow}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {row.executions}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {row.tokens}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {row.cost}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Invoice History</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.date}>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.date}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.period}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {inv.amount}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-[10px]">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon-xs" className="size-6">
                      <Download className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
