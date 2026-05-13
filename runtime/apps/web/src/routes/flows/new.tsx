import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeft,
  Plus,
  Play,
  Send,
  BrainCircuit,
  Landmark,
  CreditCard,
  Globe,
  UserCheck,
  ArrowRight,
  Layers,
  Sparkles,
  Workflow,
} from "lucide-react"

export const Route = createFileRoute("/flows/new")({ component: NewFlowPage })

const templates = [
  {
    id: "balance-alert",
    name: "Balance Alert",
    desc: "Alert when balance drops below threshold",
    nodes: [
      { icon: "Play", label: "Input", color: "#60a5fa" },
      { icon: "Landmark", label: "getBalance", color: "#a78bfa", sub: "Plaid" },
      { icon: "GitBranch", label: "If/Else", color: "#fbbf24" },
      { icon: "Send", label: "SendEmail", color: "#a78bfa" },
      { icon: "Send", label: "Output", color: "#34d399" },
    ],
  },
  {
    id: "transaction-summary",
    name: "Transaction Summary",
    desc: "Weekly spending summary",
    nodes: [
      { icon: "Play", label: "Input", color: "#60a5fa" },
      { icon: "Landmark", label: "getTransactions", color: "#a78bfa", sub: "Plaid" },
      { icon: "BrainCircuit", label: "LLM", color: "#f472b6" },
      { icon: "Send", label: "Output", color: "#34d399" },
    ],
  },
  {
    id: "payment-approval",
    name: "Payment Approval",
    desc: "Charge with human approval gate",
    nodes: [
      { icon: "Play", label: "Input", color: "#60a5fa" },
      { icon: "CreditCard", label: "createCharge", color: "#a78bfa", sub: "Stripe" },
      { icon: "UserCheck", label: "HITL", color: "#fb923c" },
      { icon: "Send", label: "Output", color: "#34d399" },
    ],
  },
  {
    id: "custom-connector-query",
    name: "Custom Connector Query",
    desc: "Call any company API, format the response",
    nodes: [
      { icon: "Play", label: "Input", color: "#60a5fa" },
      { icon: "Globe", label: "anyAction", color: "#a78bfa", sub: "Custom" },
      { icon: "BrainCircuit", label: "LLM", color: "#f472b6" },
      { icon: "Send", label: "Output", color: "#34d399" },
    ],
  },
  {
    id: "scheduled-report",
    name: "Scheduled Financial Report",
    desc: "Weekly digest on schedule",
    nodes: [
      { icon: "Play", label: "Input", color: "#60a5fa" },
      { icon: "Landmark", label: "getTransactions", color: "#a78bfa", sub: "Plaid" },
      { icon: "Layers", label: "Aggregate", color: "#fbbf24" },
      { icon: "BrainCircuit", label: "LLM", color: "#f472b6" },
      { icon: "Send", label: "SendEmail", color: "#a78bfa" },
      { icon: "Send", label: "Output", color: "#34d399" },
    ],
  },
]

const iconMap: Record<string, React.ComponentType<{ style?: React.CSSProperties; className?: string }>> = {
  Play, Send, BrainCircuit, Landmark, CreditCard, Globe, UserCheck, Layers, Workflow,
}

function GitBranch({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style} className={className}>
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

function getIcon(name: string) {
  if (name === "GitBranch") return GitBranch
  return iconMap[name] ?? Play
}

export default function NewFlowPage() {
  const navigate = useNavigate()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Button variant="ghost" size="icon-xs" asChild>
          <Link to="/flows"><ArrowLeft style={{ width: 14, height: 14 }} /></Link>
        </Button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>New Flow</h1>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", margin: "4px 0 0" }}>Start from scratch or choose a template.</p>
        </div>
      </div>

      <Separator />

      <Card size="sm" style={{ cursor: "pointer" }}
        onClick={() => navigate({ to: "/flows/$flowId", params: { flowId: "blank" } })}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px hsl(var(--primary)/0.3)" }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "" }}>
        <CardContent style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 16px" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))", flexShrink: 0 }}>
            <Plus style={{ width: 20, height: 20 }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Blank Canvas</p>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", margin: "4px 0 0" }}>Start with an empty flow and build from scratch.</p>
          </div>
          <ArrowRight style={{ width: 16, height: 16, color: "hsl(var(--muted-foreground))" }} />
        </CardContent>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles style={{ width: 16, height: 16, color: "hsl(var(--muted-foreground))" }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>Start from Template</span>
        <Badge variant="secondary" style={{ height: 18, fontSize: 10 }}>Quick Start</Badge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {templates.map((template) => (
          <Card key={template.id} size="sm"
            style={{ cursor: "pointer" }}
            onClick={() => navigate({ to: "/flows/$flowId", params: { flowId: template.id } })}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 2px hsl(var(--primary)/0.3)" }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "" }}>
            <CardHeader style={{ paddingBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <CardTitle style={{ fontSize: 14 }}>{template.name}</CardTitle>
                <Workflow style={{ width: 16, height: 16, color: "hsl(var(--muted-foreground))", opacity: 0 }} />
              </div>
              <CardDescription style={{ fontSize: 12 }}>{template.desc}</CardDescription>
            </CardHeader>
            <CardContent style={{ paddingTop: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", paddingTop: 8 }}>
                {template.nodes.map((node, i) => {
                  const NodeIcon = getIcon(node.icon)
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "6px 8px", borderRadius: 8, border: `2px solid ${node.color}`, background: `${node.color}15` }}>
                        <NodeIcon style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} />
                        <span style={{ fontSize: 9, fontWeight: 500, textAlign: "center", lineHeight: 1.2, color: node.color }}>{node.label}</span>
                        {node.sub && <span style={{ fontSize: 8, color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>{node.sub}</span>}
                      </div>
                      {i < template.nodes.length - 1 && (
                        <ArrowRight style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))", opacity: 0.4, flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
        <Button variant="outline" size="sm" asChild>
          <Link to="/flows">Cancel</Link>
        </Button>
        <Button size="sm" onClick={() => navigate({ to: "/flows/$flowId", params: { flowId: "blank" } })}>
          <Plus style={{ width: 14, height: 14 }} /> Create Flow
        </Button>
      </div>
    </div>
  )
}