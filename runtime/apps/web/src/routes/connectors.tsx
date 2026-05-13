import { createFileRoute } from "@tanstack/react-router"
import {
  CheckCircle2,
  CreditCard,
  Database,
  Globe,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wrench,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const Route = createFileRoute("/connectors")({
  component: ConnectorsPage,
})

const nativeConnectors = [
  {
    name: "Plaid",
    icon: Landmark,
    status: "connected",
    credential: "****abc123",
    lastTested: "2 min ago / pass",
    usedIn: 4,
    actions: 8,
  },
  {
    name: "Stripe",
    icon: CreditCard,
    status: "connected",
    credential: "sk_live_****def4",
    lastTested: "45 min ago / pass",
    usedIn: 3,
    actions: 13,
  },
  {
    name: "HTTP Request",
    icon: Globe,
    status: "connected",
    credential: "****",
    lastTested: "1 hour ago / pass",
    usedIn: 2,
    actions: 1,
  },
  {
    name: "NetSuite",
    icon: Database,
    status: "error",
    credential: "ns_****ghj7",
    lastTested: "2 days ago / fail",
    usedIn: 0,
    actions: 56,
  },
]

const customConnectors = [
  {
    name: "Fincen API",
    icon: Globe,
    actions: 3,
    lastSynced: "1 day ago",
    status: "active",
    usedIn: 2,
  },
  {
    name: "Internal Loans API",
    icon: Database,
    actions: 5,
    lastSynced: "3 hours ago",
    status: "active",
    usedIn: 4,
  },
  {
    name: "Risk Scoring v2",
    icon: ShieldCheck,
    actions: 2,
    lastSynced: "5 days ago",
    status: "partial",
    usedIn: 1,
  },
]

const statusBadge = (s: string) => {
  const map: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline"
      label: string
    }
  > = {
    connected: { variant: "default", label: "Connected" },
    error: { variant: "destructive", label: "Error" },
    revoked: { variant: "outline", label: "Revoked" },
    active: { variant: "default", label: "Active" },
    partial: { variant: "secondary", label: "Partial" },
  }
  const b = map[s] ?? { variant: "outline" as const, label: s }
  return <Badge variant={b.variant}>{b.label}</Badge>
}

export default function ConnectorsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Connectors</h1>
          <p className="text-sm text-muted-foreground">
            Manage API connections used across your flows.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="size-3.5" /> Add Connector
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Connector</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Connector Type</label>
                  <Select>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plaid">Plaid</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="http">HTTP Request</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">
                    API Key / Secret
                  </label>
                  <Input className="h-8 text-xs" placeholder="sk_live_..." />
                </div>
                <Button size="sm" className="w-full">
                  Save & Test Connection
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-3.5" /> Import Your API
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Custom Connector</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Upload an OpenAPI spec or define endpoints manually.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">
                    OpenAPI Spec URL
                  </label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="https://api.your-company.com/openapi.json"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">or</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Upload File</label>
                  <Input className="h-8 text-xs" type="file" />
                </div>
                <Button size="sm" className="w-full">
                  Parse API
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="native" className="flex flex-col gap-3">
        <TabsList variant="line" className="w-fit">
          <TabsTrigger value="native" className="text-xs">
            Native Connectors
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs">
            Your Connectors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="native" className="m-0">
          <Card size="sm">
            <CardContent className="px-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connector</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credential</TableHead>
                    <TableHead>Last Tested</TableHead>
                    <TableHead className="text-right">Used In</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nativeConnectors.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <c.icon className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.credential}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1">
                          {c.lastTested.endsWith("pass") ? (
                            <CheckCircle2 className="size-3 text-emerald-500" />
                          ) : (
                            <XCircle className="size-3 text-red-500" />
                          )}
                          {c.lastTested}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {c.usedIn} flows
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Wrench className="size-3.5" /> Test
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pencil className="size-3.5" /> Edit Credentials
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="size-3.5" /> Revoke
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
        </TabsContent>

        <TabsContent value="custom" className="m-0">
          <Card size="sm">
            <CardContent className="px-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Connector</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Last Synced</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Used In</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customConnectors.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <c.icon className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.actions} enabled
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.lastSynced}
                      </TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-right text-xs">
                        {c.usedIn} flows
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <RefreshCw className="size-3.5" /> Re-sync
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Pencil className="size-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="size-3.5" /> Revoke
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
