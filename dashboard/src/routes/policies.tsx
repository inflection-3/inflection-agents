import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { agents, vendorPayPolicy, invoiceBotPolicy } from "@/lib/data"
import { ChevronDown, AlertTriangle } from "lucide-react"
import { Link } from "@tanstack/react-router"

export const Route = createFileRoute("/policies")({ component: PoliciesPage })

type Policy = {
  agentId: string
  version: number
  maxPerTransaction?: number
  dailyLimit?: number
  weeklyLimit?: number
  monthlyLimit?: number
  requireHumanApproval?: number
  allowedRails: string[]
  velocityCheck: { maxCount: number; windowMinutes: number } | null | undefined
  allowedCurrencies: null
  blockedCountries: null
  updatedAt: string
}

const policies: Record<string, Policy | null> = {
  "agt_7x2kp9mn": vendorPayPolicy as Policy,
  "agt_4r8jq5vw": invoiceBotPolicy as Policy,
  "agt_2c6hn1yz": null,
}

function PoliciesPage() {
  const [selectedAgent, setSelectedAgent] = useState(agents[0].id)
  const [unsaved, setUnsaved] = useState(false)
  const [form, setForm] = useState(policies)

  const current = form[selectedAgent]

  const update = (patch: Partial<Policy>) => {
    setForm((prev) => ({
      ...prev,
      [selectedAgent]: prev[selectedAgent]
        ? { ...prev[selectedAgent]!, ...patch }
        : ({ ...patch, agentId: selectedAgent, version: 1, allowedCurrencies: null, blockedCountries: null, allowedRails: [] } as Policy),
    }))
    setUnsaved(true)
  }

  const save = () => {
    setUnsaved(false)
    alert("Policy saved")
  }

  const json = JSON.stringify(current || {}, null, 2)

  return (
    <div className="flex min-h-svh flex-col gap-3 p-3">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/">Dashboard</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Policies</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Policies</h1>
        {unsaved && <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px]">Unsaved changes</Badge>}
      </div>
      <div className="flex gap-3">
        <ScrollArea className="w-48 shrink-0 rounded-md border">
          <div className="flex flex-col p-1.5 gap-0.5">
            {agents.map((a) => {
              const hasPolicy = !!form[a.id]
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                    selectedAgent === a.id ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${hasPolicy ? "bg-primary" : "bg-muted-foreground"}`} />
                  <span className="truncate">{a.name}</span>
                </button>
              )
            })}
          </div>
        </ScrollArea>

        <div className="flex-1 min-w-0">
          <Tabs defaultValue="form">
            <TabsList className="h-7">
              <TabsTrigger value="form" className="text-xs h-6">Form</TabsTrigger>
              <TabsTrigger value="json" className="text-xs h-6">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="form" className="flex flex-col gap-2 mt-2">
              {!current ? (
                <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="size-4" />
                    <span className="text-sm font-medium">No policy set</span>
                  </div>
                  <p className="text-xs">All financial calls from this agent are currently DENIED.</p>
                  <Button
                    size="sm"
                    className="w-fit"
                    onClick={() =>
                      update({
                        maxPerTransaction: 0,
                        dailyLimit: 0,
                        requireHumanApproval: 0,
                        allowedRails: [],
                        velocityCheck: null,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    Create Policy
                  </Button>
                </div>
              ) : (
                <>
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
                      <span className="text-xs font-medium">Spend Limits</span>
                      <ChevronDown className="size-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
                      {(["maxPerTransaction", "dailyLimit", "weeklyLimit", "monthlyLimit"] as const).map((key) => (
                        <div key={key} className="flex items-center gap-2">
                          <Label className="w-36 shrink-0 text-[10px] capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </Label>
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">$</span>
                            <Input
                              type="number"
                              className="pl-5 h-6 text-xs"
                              placeholder="No limit"
                              value={(current as any)[key] ?? ""}
                              onChange={(e) => update({ [key]: e.target.value ? Number(e.target.value) : undefined } as any)}
                            />
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
                      <span className="text-xs font-medium">Human Approval</span>
                      <ChevronDown className="size-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!current.requireHumanApproval}
                          onCheckedChange={(checked) => update({ requireHumanApproval: checked ? 5000 : undefined })}
                        />
                        <Label className="text-xs">Require approval for transactions above:</Label>
                      </div>
                      {!!current.requireHumanApproval && (
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">$</span>
                          <Input
                            type="number"
                            className="pl-5 h-6 text-xs max-w-xs"
                            value={current.requireHumanApproval}
                            onChange={(e) => update({ requireHumanApproval: Number(e.target.value) })}
                          />
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
                      <span className="text-xs font-medium">Allowed Rails</span>
                      <ChevronDown className="size-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-1.5">
                      {["stripe", "circle", "x402"].map((rail) => (
                        <label key={rail} className="flex items-center gap-1.5 text-xs">
                          <Checkbox
                            checked={current.allowedRails?.includes(rail) || false}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...(current.allowedRails || []), rail]
                                : (current.allowedRails || []).filter((r) => r !== rail)
                              update({ allowedRails: next })
                            }}
                          />
                          <span className="capitalize">{rail}</span>
                        </label>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
                      <span className="text-xs font-medium">Velocity Check</span>
                      <ChevronDown className="size-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!current.velocityCheck}
                          onCheckedChange={(checked) =>
                            update({ velocityCheck: checked ? { maxCount: 20, windowMinutes: 60 } : null })
                          }
                        />
                        <Label className="text-xs">Block after N transactions in a time window</Label>
                      </div>
                      {current.velocityCheck && (
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            className="w-20 h-6 text-xs"
                            value={current.velocityCheck.maxCount}
                            onChange={(e) =>
                              update({
                                velocityCheck: { ...current.velocityCheck, maxCount: Number(e.target.value) } as { maxCount: number; windowMinutes: number },
                              })
                            }
                          />
                          <span className="self-center text-[10px] text-muted-foreground">tx in</span>
                          <Input
                            type="number"
                            className="w-20 h-6 text-xs"
                            value={current.velocityCheck.windowMinutes}
                            onChange={(e) =>
                              update({
                                velocityCheck: { ...current.velocityCheck, windowMinutes: Number(e.target.value) } as { maxCount: number; windowMinutes: number },
                              })
                            }
                          />
                          <span className="self-center text-[10px] text-muted-foreground">minutes</span>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
                      <span className="text-xs font-medium">Geographic Restrictions</span>
                      <ChevronDown className="size-3.5" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
                      <div className="flex items-center gap-2 opacity-60">
                        <Switch disabled />
                        <Label className="text-xs text-muted-foreground">Block transactions to specific countries</Label>
                        <Badge variant="secondary" className="ml-auto text-[10px]">Available in v2</Badge>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Button size="sm" onClick={save} disabled={!unsaved} className="w-fit">
                    Save Policy
                  </Button>
                </>
              )}
            </TabsContent>
            <TabsContent value="json" className="mt-2">
              <Textarea
                className="min-h-[300px] font-mono text-xs bg-accent"
                value={json}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value)
                    setForm((prev) => ({ ...prev, [selectedAgent]: parsed }))
                    setUnsaved(true)
                  } catch {
                    // ignore parse errors while typing
                  }
                }}
              />
              <Button size="sm" onClick={save} disabled={!unsaved} className="mt-2">
                Save Policy
              </Button>
            </TabsContent>
          </Tabs>

          {current && (
            <div className="mt-3 text-[10px] text-muted-foreground">
              Policy v{current.version} — saved {new Date(current.updatedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
