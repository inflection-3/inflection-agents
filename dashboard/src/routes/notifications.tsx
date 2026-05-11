import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { notificationConfigs } from "@/lib/data"
import { BellRing, Edit, Trash2 } from "lucide-react"

export const Route = createFileRoute("/notifications")({ component: NotificationsPage })

function NotificationsPage() {
  const [configs, setConfigs] = useState(notificationConfigs)
  const [editing, setEditing] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [channel, setChannel] = useState("")
  const [testResult, setTestResult] = useState<Record<string, "ok" | "fail" | null>>({})

  const handleSave = (agentId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.agentId === agentId
          ? {
              ...c,
              slack: {
                configured: true,
                webhookPreview: webhookUrl.slice(0, 30) + "••••••••••••",
                channel: channel || "#general",
                lastTestedAt: new Date().toISOString(),
                lastTestStatus: "ok" as const,
              },
            }
          : c
      )
    )
    setEditing(null)
    setWebhookUrl("")
    setChannel("")
  }

  const handleRemove = (agentId: string) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.agentId === agentId ? { ...c, slack: null } : c
      )
    )
  }

  const handleTest = (agentId: string) => {
    setTestResult((prev) => ({ ...prev, [agentId]: Math.random() > 0.2 ? "ok" : "fail" }))
    setTimeout(() => setTestResult((prev) => ({ ...prev, [agentId]: null })), 3000)
  }

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Notifications</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-lg font-semibold">Notifications</h1>

      <div className="flex flex-col gap-2">
        {configs.map((config) => (
          <Card key={config.agentId}>
            <CardHeader className="pb-1 pt-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{config.agentName}</CardTitle>
                <div className="flex gap-1.5">
                  <Badge className={`text-[10px] px-1.5 py-0 ${config.slack?.configured ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                    Slack: {config.slack?.configured ? "Configured" : "Not set"}
                  </Badge>
                  <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                    Email: Coming soon
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-3 pb-2">
              {config.slack?.configured ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Webhook:</span>
                    <code className="font-mono text-[10px] bg-accent px-1.5 py-0.5 rounded">{config.slack.webhookPreview}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Channel:</span>
                    <span className="text-xs">{config.slack.channel}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Tested 2 days ago — <span className="text-primary">✓ OK</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setEditing(config.agentId); setWebhookUrl(""); setChannel(config.slack?.channel || "") }}>
                      <Edit className="size-3 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => handleTest(config.agentId)}>
                      <BellRing className="size-3 mr-1" />
                      Test
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => handleRemove(config.agentId)}>
                      <Trash2 className="size-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                  {testResult[config.agentId] === "ok" && (
                    <p className="text-[10px] text-primary">✓ Test message sent to {config.slack.channel}</p>
                  )}
                  {testResult[config.agentId] === "fail" && (
                    <p className="text-[10px] text-destructive">✗ Webhook returned 404. Check the URL and try again.</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted-foreground">Get notified in Slack when a transaction requires approval.</p>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] w-fit" onClick={() => setEditing(config.agentId)}>
                    + Add Slack Webhook
                  </Button>
                </div>
              )}

              <Collapsible open={editing === config.agentId} onOpenChange={(o) => !o && setEditing(null)}>
                <CollapsibleContent className="flex flex-col gap-1.5 mt-2 p-2 border rounded-md">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Webhook URL</Label>
                    <Input
                      placeholder="https://hooks.slack.com/services/..."
                      className="h-6 text-xs"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                    <span className="text-[10px] text-muted-foreground">Paste your Slack Incoming Webhook URL</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[10px]">Channel (optional)</Label>
                    <Input
                      placeholder="#approvals"
                      className="h-6 text-xs"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setEditing(null)}>Cancel</Button>
                    <Button size="sm" className="h-6 text-[10px]" onClick={() => handleSave(config.agentId)}>Save Webhook</Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              <div className="flex flex-col gap-1 opacity-60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Email notifications</span>
                  <Badge variant="secondary" className="text-[10px]">Available in v2</Badge>
                </div>
                <Input disabled placeholder="you@company.com" className="h-6 text-xs" />
                <Button size="sm" disabled className="h-6 text-[10px] w-fit">Save Email</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
