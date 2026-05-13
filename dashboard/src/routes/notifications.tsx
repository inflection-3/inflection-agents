import { Link, createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { Edit, Trash2 } from "lucide-react"
import type {Agent, NotificationConfig} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {   fetchAgents, fetchNotifications, updateNotifications } from "@/lib/api"

export const Route = createFileRoute("/notifications")({ component: NotificationsPage })

function NotificationsPage() {
  const [agents, setAgents] = useState<Array<Agent>>([])
  const [configs, setConfigs] = useState<Record<string, NotificationConfig | undefined>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<string | null>(null)
  const [webhookUrl, setWebhookUrl] = useState("")
  const [emails, setEmails] = useState("")
  const [timeoutSeconds, setTimeoutSeconds] = useState(3600)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const ags = await fetchAgents()
      setAgents(ags.filter((a) => a.status !== "deleted"))
      const cfgMap: Record<string, NotificationConfig> = {}
      await Promise.all(
        ags.map(async (a) => {
          try {
            const cfg = await fetchNotifications(a.id)
            cfgMap[a.id] = cfg
          } catch {
            // no config yet
          }
        })
      )
      setConfigs(cfgMap)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (agentId: string) => {
    try {
      const emailList = emails.split(",").map((s) => s.trim()).filter(Boolean)
      const cfg = await updateNotifications(agentId, {
        emailAddresses: emailList,
        approvalTimeoutSeconds: timeoutSeconds,
        slackWebhookUrl: webhookUrl || undefined,
      })
      setConfigs((prev) => ({ ...prev, [agentId]: cfg }))
      setEditing(null)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleRemove = async (agentId: string) => {
    try {
      await updateNotifications(agentId, { emailAddresses: [], approvalTimeoutSeconds: 3600 })
      setConfigs((prev) => {
        const next = { ...prev }
        delete next[agentId]
        return next
      })
    } catch (err: any) {
      setError(err.message)
    }
  }

  const getEmails = (cfg: NotificationConfig) => {
    try {
      return JSON.parse(cfg.emailAddresses) as Array<string>
    } catch {
      return []
    }
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
      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => {
            const cfg = configs[agent.id]
            const hasConfig = !!cfg
            const emailList = hasConfig ? getEmails(cfg) : []
            return (
              <Card key={agent.id}>
                <CardHeader className="pb-1 pt-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{agent.name}</CardTitle>
                    <div className="flex gap-1.5">
                      <Badge className={`text-[10px] px-1.5 py-0 ${hasConfig ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {hasConfig ? "Configured" : "Not set"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-3 pb-2">
                  {hasConfig ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Emails:</span>
                        <span className="text-xs">{emailList.join(", ") || "None"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Timeout:</span>
                        <span className="text-xs">{cfg.approvalTimeoutSeconds}s</span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { setEditing(agent.id); setEmails(emailList.join(", ")); setTimeoutSeconds(cfg.approvalTimeoutSeconds); setWebhookUrl(""); }}>
                          <Edit className="size-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive" onClick={() => handleRemove(agent.id)}>
                          <Trash2 className="size-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <p className="text-xs text-muted-foreground">Get notified when a transaction requires approval.</p>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] w-fit" onClick={() => { setEditing(agent.id); setEmails(""); setTimeoutSeconds(3600); setWebhookUrl(""); }}>
                        + Configure Notifications
                      </Button>
                    </div>
                  )}

                  <Collapsible open={editing === agent.id} onOpenChange={(o) => !o && setEditing(null)}>
                    <CollapsibleContent className="flex flex-col gap-1.5 mt-2 p-2 border rounded-md">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px]">Email Addresses (comma-separated)</Label>
                        <Input
                          placeholder="ops@company.com, cfo@company.com"
                          className="h-6 text-xs"
                          value={emails}
                          onChange={(e) => setEmails(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px]">Slack Webhook URL (optional)</Label>
                        <Input
                          placeholder="https://hooks.slack.com/services/..."
                          className="h-6 text-xs"
                          value={webhookUrl}
                          onChange={(e) => setWebhookUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[10px]">Approval Timeout (seconds)</Label>
                        <Input
                          type="number"
                          className="h-6 text-xs w-32"
                          value={timeoutSeconds}
                          onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="sm" className="h-6 text-[10px]" onClick={() => handleSave(agent.id)}>Save</Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
