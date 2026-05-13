import { Link, createFileRoute } from "@tanstack/react-router"
import {
  Archive,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export const Route = createFileRoute("/flows/")({ component: FlowsPage })

const flows = [
  {
    id: "1",
    name: "Balance Alert",
    status: "production",
    lastPublished: "2 days ago",
    lastEdited: "2 days ago by jane",
    executions24h: 248,
    successRate24h: 99.2,
    createdBy: { name: "Jane Doe", initials: "JD" },
  },
  {
    id: "2",
    name: "Transaction Summary",
    status: "production",
    lastPublished: "5 days ago",
    lastEdited: "1 day ago by john",
    executions24h: 186,
    successRate24h: 97.8,
    createdBy: { name: "John Smith", initials: "JS" },
  },
  {
    id: "3",
    name: "Payment Approval",
    status: "production",
    lastPublished: "3 hours ago",
    lastEdited: "3 hours ago by jane",
    executions24h: 42,
    successRate24h: 100,
    createdBy: { name: "Jane Doe", initials: "JD" },
  },
  {
    id: "4",
    name: "Custom Connector Query",
    status: "draft",
    lastPublished: "—",
    lastEdited: "10 min ago by alice",
    executions24h: 0,
    successRate24h: 0,
    createdBy: { name: "Alice Chen", initials: "AC" },
  },
  {
    id: "5",
    name: "Weekly Spending Digest",
    status: "draft",
    lastPublished: "—",
    lastEdited: "1 hour ago by john",
    executions24h: 0,
    successRate24h: 0,
    createdBy: { name: "John Smith", initials: "JS" },
  },
  {
    id: "6",
    name: "Invoice Auto-Approve",
    status: "archived",
    lastPublished: "2 months ago",
    lastEdited: "2 months ago by jane",
    executions24h: 0,
    successRate24h: 0,
    createdBy: { name: "Jane Doe", initials: "JD" },
  },
  {
    id: "7",
    name: "Stock Price Monitor",
    status: "draft",
    lastPublished: "—",
    lastEdited: "3 days ago by alice",
    executions24h: 12,
    successRate24h: 91.7,
    createdBy: { name: "Alice Chen", initials: "AC" },
  },
  {
    id: "8",
    name: "Scheduled Financial Report",
    status: "production",
    lastPublished: "1 week ago",
    lastEdited: "1 week ago by jane",
    executions24h: 56,
    successRate24h: 98.2,
    createdBy: { name: "Jane Doe", initials: "JD" },
  },
]

const statusVariant = (s: string) => {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    production: "default",
    draft: "secondary",
    archived: "outline",
  }
  return map[s] ?? "outline"
}

const successColor = (rate: number) => {
  if (rate === 0) return "text-muted-foreground"
  if (rate >= 95) return "text-emerald-600"
  if (rate >= 80) return "text-amber-600"
  return "text-red-600"
}

export default function FlowsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Flows</h1>
          <p className="text-sm text-muted-foreground">
            Build and manage your agent workflows.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/flows/new">
            <Plus className="size-3.5" /> New Flow
          </Link>
        </Button>
      </div>

      <Card size="sm">
        <CardHeader className="flex-row items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search flows..."
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Last Published</TableHead>
                <TableHead className="w-[150px]">Last Edited</TableHead>
                <TableHead className="w-[100px] text-right">
                  Exec (24h)
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  Success Rate
                </TableHead>
                <TableHead className="w-[100px]">Created By</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((flow) => (
                <TableRow key={flow.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/flows/$flowId"
                      params={{ flowId: flow.id }}
                      className="hover:underline"
                    >
                      {flow.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant(flow.status)}
                      className="capitalize"
                    >
                      {flow.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {flow.lastPublished}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {flow.lastEdited}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {flow.executions24h}
                  </TableCell>
                  <TableCell
                    className={`text-right text-xs font-medium ${successColor(flow.successRate24h)}`}
                  >
                    {flow.successRate24h > 0 ? `${flow.successRate24h}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Avatar size="sm" className="size-5">
                        <AvatarFallback className="text-[10px]">
                          {flow.createdBy.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {flow.createdBy.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/flows/$flowId"
                            params={{ flowId: flow.id }}
                          >
                            <ExternalLink className="size-3.5" /> Open Canvas
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Pencil className="size-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="size-3.5" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Archive className="size-3.5" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
