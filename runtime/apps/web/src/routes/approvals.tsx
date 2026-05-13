import { createFileRoute } from "@tanstack/react-router"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Search,
  XCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

export const Route = createFileRoute("/approvals")({ component: ApprovalsPage })

const approvals = [
  {
    id: "APR-0042",
    flow: "Payment Approval",
    action: "stripe.createCharge",
    requestedBy: "user_8291",
    amount: "$1,250.00",
    requested: "8 min ago",
    expires: "52 min",
    status: "pending",
    reviewer: null,
  },
  {
    id: "APR-0041",
    flow: "Invoice Approval",
    action: "stripe.createRefund",
    requestedBy: "user_3321",
    amount: "$340.50",
    requested: "45 min ago",
    expires: "15 min",
    status: "pending",
    reviewer: null,
  },
  {
    id: "APR-0040",
    flow: "Payment Approval",
    action: "stripe.createCharge",
    requestedBy: "user_1288",
    amount: "$89.99",
    requested: "2 hours ago",
    expires: "—",
    status: "approved",
    reviewer: "Jane Doe",
  },
  {
    id: "APR-0039",
    flow: "Custom Connector Query",
    action: "fincen.exportData",
    requestedBy: "user_5510",
    amount: "—",
    requested: "3 hours ago",
    expires: "—",
    status: "rejected",
    reviewer: "John Smith",
  },
  {
    id: "APR-0038",
    flow: "Balance Alert",
    action: "plaid.getTransactions",
    requestedBy: "user_2044",
    amount: "—",
    requested: "1 day ago",
    expires: "—",
    status: "approved",
    reviewer: "Jane Doe",
  },
  {
    id: "APR-0037",
    flow: "Payment Approval",
    action: "stripe.createCharge",
    requestedBy: "user_7732",
    amount: "$450.00",
    requested: "1 day ago",
    expires: "—",
    status: "expired",
    reviewer: null,
  },
  {
    id: "APR-0036",
    flow: "Invoice Approval",
    action: "netsuite.approveInvoice",
    requestedBy: "user_4419",
    amount: "$12,500.00",
    requested: "2 days ago",
    expires: "—",
    status: "rejected",
    reviewer: "Alice Chen",
  },
]

const statusIcon = (s: string) => {
  switch (s) {
    case "pending":
      return <Clock className="size-3 text-amber-500" />
    case "approved":
      return <CheckCircle2 className="size-3 text-emerald-500" />
    case "rejected":
      return <XCircle className="size-3 text-red-500" />
    case "expired":
      return <AlertCircle className="size-3 text-muted-foreground" />
    default:
      return null
  }
}

const statusBadge = (s: string) => {
  const map: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline"
      label: string
    }
  > = {
    pending: { variant: "secondary", label: "Pending" },
    approved: { variant: "default", label: "Approved" },
    rejected: { variant: "destructive", label: "Rejected" },
    expired: { variant: "outline", label: "Expired" },
  }
  const b = map[s] ?? { variant: "outline" as const, label: s }
  return <Badge variant={b.variant}>{b.label}</Badge>
}

export default function ApprovalsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and resolve human-in-the-loop requests.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <TabsList variant="line" className="w-fit">
            <TabsTrigger value="pending" className="text-xs">
              Pending{" "}
              <Badge variant="secondary" className="ml-1 h-4.5 text-[10px]">
                2
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue placeholder="Flow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Flows</SelectItem>
                <SelectItem value="payment">Payment Approval</SelectItem>
                <SelectItem value="invoice">Invoice Approval</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="h-7 w-40 pl-7 text-xs"
              />
            </div>
          </div>
        </div>

        {["pending", "approved", "rejected", "all"].map((tab) => (
          <TabsContent key={tab} value={tab} className="m-0">
            <Card size="sm">
              <CardContent className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead>Flow</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reviewer</TableHead>
                      <TableHead className="w-[80px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvals
                      .filter((a) => tab === "all" || a.status === tab)
                      .map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">
                            {a.id}
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {a.flow}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {a.action}
                          </TableCell>
                          <TableCell className="text-xs">
                            {a.requestedBy}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {a.amount}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.requested}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.expires}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {statusIcon(a.status)}
                              {statusBadge(a.status)}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.reviewer ?? "—"}
                          </TableCell>
                          <TableCell>
                            {a.status === "pending" ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon-xs"
                                  variant="default"
                                  className="size-6"
                                >
                                  <CheckCircle2 className="size-3" />
                                </Button>
                                <Button
                                  size="icon-xs"
                                  variant="destructive"
                                  className="size-6"
                                >
                                  <XCircle className="size-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="xs" variant="ghost">
                                <Eye className="size-3" /> View
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
