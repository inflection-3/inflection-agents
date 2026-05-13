import { Link, createFileRoute  } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import type {Agent, AgentPolicy, Connector, ConnectorPolicy} from "@/lib/api"
import { ACTIONS_BY_RAIL, CURRENCIES_BY_RAIL, type Rail } from "@/lib/rail-registry"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {
  
  
  
  
  createAgentPolicy,
  createConnectorPolicy,
  fetchAgentPolicies,
  fetchAgents,
  fetchConnectorPolicies,
  fetchConnectors
} from "@/lib/api"

export const Route = createFileRoute("/policies")({ component: PoliciesPage })

export interface PolicyRules {
  allowedRails?: Array<string>
  globalVelocityCheck?: { maxTransactions: number; windowSeconds: number }
  globalDailyLimit?: { amount: number; currency: string }
  globalMonthlyLimit?: { amount: number; currency: string }
  blockedCountries?: Array<string>
  blocklist?: { entities?: Array<string>; domains?: Array<string> }
  allowedActions?: Array<string>
  actionLimits?: Record<string, { maxAmount: number; currency: string }>
  maxPerTransaction?: { amount: number; currency: string }
  dailyLimit?: { amount: number; currency: string }
  weeklyLimit?: { amount: number; currency: string }
  monthlyLimit?: { amount: number; currency: string }
  requireHumanApproval?: { above: number; currency: string }
  velocityCheck?: { maxTransactions: number; windowSeconds: number }
  allowedCurrencies?: Array<string>
  allowedCountries?: Array<string>
  blockedCountriesConnector?: Array<string>
  recipientDailyLimit?: { amount: number; currency: string }
  scheduleWindow?: { daysOfWeek: Array<number>; startUtcHour: number; endUtcHour: number; timezone?: string }
}

function PoliciesPage() {
  const [agents, setAgents] = useState<Array<Agent>>([])
  const [connectors, setConnectors] = useState<Array<Connector>>([])
  const [agentPolicies, setAgentPolicies] = useState<Record<string, Array<AgentPolicy> | undefined>>({})
  const [connectorPolicies, setConnectorPolicies] = useState<Record<string, Array<ConnectorPolicy> | undefined>>({})
  const [selectedAgent, setSelectedAgent] = useState("")
  const [selectedConnector, setSelectedConnector] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [unsaved, setUnsaved] = useState(false)

  // Form state for agent policy
  const [agentRules, setAgentRules] = useState<PolicyRules>({})
  // Form state for connector policy
  const [connectorRules, setConnectorRules] = useState<PolicyRules>({})

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedAgent) {
      loadAgentPolicies(selectedAgent)
    }
  }, [selectedAgent])

  useEffect(() => {
    if (selectedConnector) {
      loadConnectorPolicies(selectedConnector)
    }
  }, [selectedConnector])

  const loadData = async () => {
    try {
      setLoading(true)
      const [ags, cons] = await Promise.all([fetchAgents(), fetchConnectors()])
      setAgents(ags.filter((a) => a.status !== "deleted"))
      setConnectors(cons.filter((c) => c.status === "active"))
      if (ags.length > 0) setSelectedAgent(ags[0].id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadAgentPolicies = async (agentId: string) => {
    try {
      const data = await fetchAgentPolicies(agentId)
      setAgentPolicies((prev) => ({ ...prev, [agentId]: data }))
      if (data.length > 0) {
        setAgentRules(data[0].rules)
      } else {
        setAgentRules({})
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadConnectorPolicies = async (connectorId: string) => {
    try {
      const data = await fetchConnectorPolicies(connectorId)
      setConnectorPolicies((prev) => ({ ...prev, [connectorId]: data }))
      if (data.length > 0) {
        setConnectorRules(data[0].rules)
      } else {
        setConnectorRules({})
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const saveAgentPolicy = async () => {
    if (!selectedAgent) return
    try {
      setSaving(true)
      await createAgentPolicy(selectedAgent, agentRules as Record<string, unknown>)
      await loadAgentPolicies(selectedAgent)
      setUnsaved(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveConnectorPolicy = async () => {
    if (!selectedConnector) return
    try {
      setSaving(true)
      await createConnectorPolicy(selectedConnector, connectorRules as Record<string, unknown>)
      await loadConnectorPolicies(selectedConnector)
      setUnsaved(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateAgentRule = (patch: Partial<PolicyRules>) => {
    setAgentRules((prev) => ({ ...prev, ...patch }))
    setUnsaved(true)
  }

  const updateConnectorRule = (patch: Partial<PolicyRules>) => {
    setConnectorRules((prev) => ({ ...prev, ...patch }))
    setUnsaved(true)
  }

  const currentAgentPolicies = agentPolicies[selectedAgent] || []
  const currentConnectorPolicies = connectorPolicies[selectedConnector] || []

  const agentConnectors = connectors.filter((c) => c.agentId === selectedAgent)
  const selectedConnectorRail = connectors.find((c) => c.id === selectedConnector)?.rail as Rail | undefined

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

      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {loading ? (
        <div className="flex gap-3">
          <Skeleton className="h-64 w-48" />
          <Skeleton className="h-64 flex-1" />
        </div>
      ) : (
        <div className="flex gap-3">
          <ScrollArea className="w-48 shrink-0 rounded-md border">
            <div className="flex flex-col p-1.5 gap-0.5">
              {agents.map((a) => {
                const hasPolicy = (agentPolicies[a.id] || []).length > 0
                return (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedAgent(a.id); setSelectedConnector(""); }}
                    className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${selectedAgent === a.id ? "bg-accent" : "hover:bg-accent/50"}`}
                  >
                    <span className={`size-1.5 rounded-full ${hasPolicy ? "bg-primary" : "bg-muted-foreground"}`} />
                    <span className="truncate">{a.name}</span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>

          <div className="flex-1 min-w-0">
            <Tabs defaultValue="agent">
              <TabsList className="h-7">
                <TabsTrigger value="agent" className="text-xs h-6">Agent Policy</TabsTrigger>
                <TabsTrigger value="connector" className="text-xs h-6">Connector Policy</TabsTrigger>
                <TabsTrigger value="history" className="text-xs h-6">History</TabsTrigger>
              </TabsList>

              <TabsContent value="agent" className="flex flex-col gap-2 mt-2">
                <AgentPolicyForm rules={agentRules} onChange={updateAgentRule} />
                <Button size="sm" onClick={saveAgentPolicy} disabled={!unsaved || saving} className="w-fit">
                  {saving ? "Saving..." : "Save Agent Policy"}
                </Button>
              </TabsContent>

              <TabsContent value="connector" className="flex flex-col gap-2 mt-2">
                {agentConnectors.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No connectors for this agent. Connect a payment provider first.</div>
                ) : (
                  <>
                    <select
                      className="h-8 text-xs rounded-md border px-2 w-fit"
                      value={selectedConnector}
                      onChange={(e) => setSelectedConnector(e.target.value)}
                    >
                      <option value="">Select a connector...</option>
                      {agentConnectors.map((c) => (
                        <option key={c.id} value={c.id}>{c.rail} — {c.maskedCredential}</option>
                      ))}
                    </select>
                    {selectedConnector && (
                      <>
                        <ConnectorPolicyForm rules={connectorRules} onChange={updateConnectorRule} rail={selectedConnectorRail} />
                        <Button size="sm" onClick={saveConnectorPolicy} disabled={!unsaved || saving} className="w-fit">
                          {saving ? "Saving..." : "Save Connector Policy"}
                        </Button>
                      </>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-2">
                <div className="flex flex-col gap-2">
                  <div>
                    <h3 className="text-xs font-semibold mb-1">Agent Policy Versions</h3>
                    {currentAgentPolicies.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No agent policies yet.</p>
                    ) : (
                      currentAgentPolicies.map((p) => (
                        <div key={p.id} className="text-[10px] border rounded-md p-2 mb-1">
                          <div className="flex justify-between">
                            <span className="font-medium">v{p.version}</span>
                            <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</span>
                          </div>
                          <pre className="mt-1 text-[9px] bg-accent p-1 rounded overflow-auto">{JSON.stringify(p.rules, null, 2)}</pre>
                        </div>
                      ))
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold mb-1">Connector Policy Versions</h3>
                    {currentConnectorPolicies.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">No connector policies yet.</p>
                    ) : (
                      currentConnectorPolicies.map((p) => (
                        <div key={p.id} className="text-[10px] border rounded-md p-2 mb-1">
                          <div className="flex justify-between">
                            <span className="font-medium">v{p.version}</span>
                            <span className="text-muted-foreground">{new Date(p.createdAt).toLocaleString()}</span>
                          </div>
                          <pre className="mt-1 text-[9px] bg-accent p-1 rounded overflow-auto">{JSON.stringify(p.rules, null, 2)}</pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  )
}

function AgentPolicyForm({ rules, onChange }: { rules: PolicyRules; onChange: (patch: Partial<PolicyRules>) => void }) {
  const rails = ["stripe", "circle", "x402", "square", "braintree", "razorpay"]

  return (
    <div className="flex flex-col gap-2">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Allowed Rails</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-1.5">
          {rails.map((rail) => (
            <label key={rail} className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={rules.allowedRails?.includes(rail) || false}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...(rules.allowedRails || []), rail]
                    : (rules.allowedRails || []).filter((r) => r !== rail)
                  onChange({ allowedRails: next })
                }}
              />
              <span className="capitalize">{rail}</span>
            </label>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Spend Limits (Agent-Level)</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
          <LimitInput label="Global Daily Limit" value={rules.globalDailyLimit} onChange={(v) => onChange({ globalDailyLimit: v })} />
          <LimitInput label="Global Monthly Limit" value={rules.globalMonthlyLimit} onChange={(v) => onChange({ globalMonthlyLimit: v })} />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Velocity & Rate Limits</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
          <VelocityInput label="Global Velocity" value={rules.globalVelocityCheck} onChange={(v) => onChange({ globalVelocityCheck: v })} />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Geographic & Blocklist</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">Blocked Countries (comma-separated ISO codes)</Label>
            <Input
              className="h-6 text-xs"
              placeholder="KP, IR, CU, SY"
              value={rules.blockedCountries?.join(", ") || ""}
              onChange={(e) => onChange({ blockedCountries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">Blocked Entities (comma-separated)</Label>
            <Input
              className="h-6 text-xs"
              placeholder="Entity A, Entity B"
              value={rules.blocklist?.entities?.join(", ") || ""}
              onChange={(e) => onChange({ blocklist: { ...rules.blocklist, entities: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">Blocked Domains (comma-separated)</Label>
            <Input
              className="h-6 text-xs"
              placeholder="fraud.example.com"
              value={rules.blocklist?.domains?.join(", ") || ""}
              onChange={(e) => onChange({ blocklist: { ...rules.blocklist, domains: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ConnectorPolicyForm({ rules, onChange, rail }: {
  rules: PolicyRules
  onChange: (patch: Partial<PolicyRules>) => void
  rail?: Rail
}) {
  const actions = rail ? [...ACTIONS_BY_RAIL[rail]] : []
  const currencies = rail ? [...CURRENCIES_BY_RAIL[rail]] : []
  const defaultCurrency = currencies[0]?.toUpperCase() ?? "USD"

  return (
    <div className="flex flex-col gap-2">
      {rail && (
        <div className="flex items-center gap-1.5 rounded-md bg-accent/40 px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground">Rail:</span>
          <span className="text-[10px] font-semibold capitalize">{rail}</span>
          <span className="text-[10px] text-muted-foreground ml-2">{actions.length} supported actions · {currencies.length} currencies</span>
        </div>
      )}

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Allowed Actions</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-1.5">
          {actions.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">Select a connector to see available actions.</p>
          ) : (
            actions.map((action) => (
              <label key={action} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={rules.allowedActions?.includes(action) || false}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...(rules.allowedActions || []), action]
                      : (rules.allowedActions || []).filter((a) => a !== action)
                    onChange({ allowedActions: next })
                  }}
                />
                <span className="font-mono text-[11px]">{action}</span>
              </label>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Spend Limits (Connector-Level)</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
          <LimitInput label="Max Per Transaction" value={rules.maxPerTransaction} defaultCurrency={defaultCurrency} onChange={(v) => onChange({ maxPerTransaction: v })} />
          <LimitInput label="Daily Limit" value={rules.dailyLimit} defaultCurrency={defaultCurrency} onChange={(v) => onChange({ dailyLimit: v })} />
          <LimitInput label="Weekly Limit" value={rules.weeklyLimit} defaultCurrency={defaultCurrency} onChange={(v) => onChange({ weeklyLimit: v })} />
          <LimitInput label="Monthly Limit" value={rules.monthlyLimit} defaultCurrency={defaultCurrency} onChange={(v) => onChange({ monthlyLimit: v })} />
          <LimitInput label="Recipient Daily Limit" value={rules.recipientDailyLimit} defaultCurrency={defaultCurrency} onChange={(v) => onChange({ recipientDailyLimit: v })} />
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
              checked={!!rules.requireHumanApproval}
              onCheckedChange={(checked) => onChange({ requireHumanApproval: checked ? { above: 5000, currency: defaultCurrency } : undefined })}
            />
            <Label className="text-xs">Require approval for transactions above:</Label>
          </div>
          {rules.requireHumanApproval && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">$</span>
                <Input
                  type="number"
                  className="pl-5 h-6 text-xs"
                  value={rules.requireHumanApproval.above}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    if (rules.requireHumanApproval) {
                      onChange({ requireHumanApproval: { above: val, currency: rules.requireHumanApproval.currency || defaultCurrency } })
                    }
                  }}
                />
              </div>
              {currencies.length > 1 ? (
                <select
                  className="w-24 h-6 text-xs rounded-md border px-1.5"
                  value={rules.requireHumanApproval.currency || defaultCurrency}
                  onChange={(e) => {
                    if (rules.requireHumanApproval) {
                      onChange({ requireHumanApproval: { above: rules.requireHumanApproval.above || 0, currency: e.target.value } })
                    }
                  }}
                >
                  {currencies.map((c) => <option key={c} value={c.toUpperCase()}>{c.toUpperCase()}</option>)}
                </select>
              ) : (
                <Input className="w-20 h-6 text-xs" value={rules.requireHumanApproval.currency || defaultCurrency} readOnly />
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Velocity Check</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
          <VelocityInput label="Connector Velocity" value={rules.velocityCheck} onChange={(v) => onChange({ velocityCheck: v })} />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border p-2.5 text-left hover:bg-accent/50">
          <span className="text-xs font-medium">Currencies & Geography</span>
          <ChevronDown className="size-3.5" />
        </CollapsibleTrigger>
        <CollapsibleContent className="p-2.5 border-x border-b rounded-b-md flex flex-col gap-2">
          {currencies.length > 0 && (
            <div className="flex flex-col gap-1">
              <Label className="text-[10px]">Allowed Currencies</Label>
              <div className="flex flex-wrap gap-1.5">
                {currencies.map((c) => (
                  <label key={c} className="flex items-center gap-1 text-[11px]">
                    <Checkbox
                      checked={rules.allowedCurrencies?.includes(c.toUpperCase()) || false}
                      onCheckedChange={(checked) => {
                        const next = checked
                          ? [...(rules.allowedCurrencies || []), c.toUpperCase()]
                          : (rules.allowedCurrencies || []).filter((x) => x !== c.toUpperCase())
                        onChange({ allowedCurrencies: next })
                      }}
                    />
                    <span className="font-mono">{c.toUpperCase()}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">Allowed Countries (comma-separated ISO codes)</Label>
            <Input className="h-6 text-xs" placeholder="US, GB, DE" value={rules.allowedCountries?.join(", ") || ""} onChange={(e) => onChange({ allowedCountries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px]">Blocked Countries (comma-separated ISO codes)</Label>
            <Input className="h-6 text-xs" placeholder="KP, IR" value={rules.blockedCountriesConnector?.join(", ") || ""} onChange={(e) => onChange({ blockedCountriesConnector: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function LimitInput({ label, value, onChange, defaultCurrency = "USD" }: { label: string; value?: { amount: number; currency: string }; defaultCurrency?: string; onChange: (v?: { amount: number; currency: string }) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="w-36 shrink-0 text-[10px]">{label}</Label>
      <div className="relative flex-1">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">$</span>
        <Input
          type="number"
          className="pl-5 h-6 text-xs"
          placeholder="No limit"
          value={value?.amount ?? ""}
          onChange={(e) => {
            const amount = e.target.value ? Number(e.target.value) : undefined
            if (amount === undefined) onChange(undefined)
            else onChange({ amount, currency: value?.currency || defaultCurrency })
          }}
        />
      </div>
      <Input className="w-16 h-6 text-xs" value={value?.currency || defaultCurrency} onChange={(e) => value && onChange({ ...value, currency: e.target.value })} />
    </div>
  )
}

function VelocityInput({ label, value, onChange }: { label: string; value?: { maxTransactions: number; windowSeconds: number }; onChange: (v?: { maxTransactions: number; windowSeconds: number }) => void }) {
  const enabled = !!value
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={(checked) => onChange(checked ? { maxTransactions: 20, windowSeconds: 3600 } : undefined)} />
        <Label className="text-xs">{label}</Label>
      </div>
      {enabled && (
        <div className="flex gap-2">
          <Input type="number" className="w-20 h-6 text-xs" value={value.maxTransactions} onChange={(e) => onChange({ ...value, maxTransactions: Number(e.target.value) })} />
          <span className="self-center text-[10px] text-muted-foreground">tx in</span>
          <Input type="number" className="w-20 h-6 text-xs" value={value.windowSeconds} onChange={(e) => onChange({ ...value, windowSeconds: Number(e.target.value) })} />
          <span className="self-center text-[10px] text-muted-foreground">seconds</span>
        </div>
      )}
    </div>
  )
}
