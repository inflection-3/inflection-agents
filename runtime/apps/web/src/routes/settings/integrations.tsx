import { createFileRoute } from "@tanstack/react-router"
import { Bell, Copy, ExternalLink, Hash, Mail, Webhook } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/settings/integrations")({
  component: IntegrationsPage,
})

const webhookEvents = [
  { id: "approval.requested", label: "approval.requested", checked: true },
  { id: "execution.failed", label: "execution.failed", checked: true },
  { id: "kill_switch.toggled", label: "kill_switch.toggled", checked: true },
  { id: "execution.completed", label: "execution.completed", checked: false },
  { id: "flow.published", label: "flow.published", checked: false },
  { id: "user.invited", label: "user.invited", checked: false },
]

const deliveries = [
  {
    time: "2 min ago",
    status: 200,
    preview: '{"event":"approval.requested"...',
  },
  { time: "5 min ago", status: 200, preview: '{"event":"execution.failed"...' },
  { time: "12 min ago", status: 500, preview: '{"error":"timeout"}' },
  {
    time: "18 min ago",
    status: 200,
    preview: '{"event":"kill_switch.toggled"...',
  },
  {
    time: "24 min ago",
    status: 200,
    preview: '{"event":"approval.requested"...',
  },
  {
    time: "45 min ago",
    status: 200,
    preview: '{"event":"execution.completed"...',
  },
  { time: "1 hour ago", status: 200, preview: '{"event":"flow.published"...' },
  { time: "2 hours ago", status: 200, preview: '{"event":"user.invited"...' },
  {
    time: "3 hours ago",
    status: 500,
    preview: '{"error":"connection refused"}',
  },
  {
    time: "5 hours ago",
    status: 200,
    preview: '{"event":"approval.requested"...',
  },
]

export default function IntegrationsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Configure workspace-level notification integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Email (SendGrid)</CardTitle>
            </div>
            <Badge variant="default" className="text-[10px]">
              Connected
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Approval emails, failure alerts, invites
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                Configure
              </Button>
              <Button size="sm" variant="outline">
                Test
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Slack</CardTitle>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Not connected
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Approval notifications, kill switch alerts, digest
            </p>
            <Button size="sm" variant="outline" className="w-fit">
              Configure
            </Button>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">PagerDuty</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Unavailable
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              On-call alerts for critical failures (Phase 3)
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Webhook className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm">Webhook</CardTitle>
            </div>
            <Badge variant="default" className="text-[10px]">
              Connected
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              POST to your endpoint on any Inflection event
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                Configure
              </Button>
              <Button size="sm" variant="outline">
                Test
              </Button>
              <Button size="sm" variant="outline">
                View Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <Webhook className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">Webhook Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium">Endpoint URL</label>
            <div className="flex items-center gap-1">
              <Input
                className="h-7 font-mono text-xs"
                value="https://hooks.acmecorp.com/inflection"
                readOnly
              />
              <Button variant="ghost" size="icon-xs" className="size-7">
                <Copy className="size-3" />
              </Button>
              <Button variant="ghost" size="icon-xs" className="size-7">
                <ExternalLink className="size-3" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium">Events</label>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {webhookEvents.map((event) => (
                <label
                  key={event.id}
                  className="flex cursor-pointer items-center gap-1.5"
                >
                  <Checkbox
                    defaultChecked={event.checked}
                    className="size-3.5"
                  />
                  <span className="font-mono text-xs">{event.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium">HMAC Secret</label>
            <Input
              className="h-7 font-mono text-xs"
              type="password"
              value="••••••••••••••••"
              readOnly
            />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Recent Delivery Attempts</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preview</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.time}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={d.status === 200 ? "default" : "destructive"}
                      className="font-mono text-[10px]"
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate font-mono text-xs text-muted-foreground">
                    {d.preview}
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
