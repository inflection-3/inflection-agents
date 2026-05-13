import { createFileRoute } from "@tanstack/react-router"
import {
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Clock,
  GitBranch,
  Landmark,
  Play,
  Send,
  UserCheck,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/analytics/executions/$executionId")({
  component: ExecutionDetailPage,
})

const steps = [
  {
    id: "step-1",
    nodeName: "Input",
    nodeType: "input",
    icon: Play,
    status: "completed",
    durationMs: 12,
    inputs: { message: '"Check if my balance is below $500"' },
    outputs: {
      userId: "user_8291",
      workspaceId: "ws_abc123",
      trigger: "user_message",
    },
  },
  {
    id: "step-2",
    nodeName: "Plaid (getBalance)",
    nodeType: "connector",
    icon: Landmark,
    status: "completed",
    durationMs: 840,
    inputs: { accountId: "acc_4242", env: "production" },
    outputs: { balance: 423.5, currency: "USD", accountName: "Checking" },
  },
  {
    id: "step-3",
    nodeName: "If/Else",
    nodeType: "flow",
    icon: GitBranch,
    status: "completed",
    durationMs: 32,
    inputs: { balance: 423.5, threshold: 500 },
    outputs: { condition: true, branch: "true" },
  },
  {
    id: "step-4",
    nodeName: "LLM (Summary)",
    nodeType: "llm",
    icon: BrainCircuit,
    status: "completed",
    durationMs: 2450,
    inputs: { model: "claude-sonnet-4-20250514", temperature: 0.2 },
    outputs: {
      summary:
        "Your checking balance is $423.50, which is $76.50 below your $500 threshold.",
      tokens: { prompt: 142, completion: 28 },
    },
  },
  {
    id: "step-5",
    nodeName: "HITL",
    nodeType: "hitl",
    icon: UserCheck,
    status: "waiting_approval",
    durationMs: 12500,
    inputs: { action: "Send low-balance alert email", amount: null },
    outputs: null,
  },
  {
    id: "step-6",
    nodeName: "Send Email",
    nodeType: "connector",
    icon: Send,
    status: "pending",
    durationMs: null,
    inputs: null,
    outputs: null,
  },
  {
    id: "step-7",
    nodeName: "Output",
    nodeType: "output",
    icon: Send,
    status: "pending",
    durationMs: null,
    inputs: null,
    outputs: null,
  },
]

const auditEvents = [
  {
    type: "execution.started",
    outcome: "ALLOW",
    time: "14:32:01.234Z",
    hash: "a3f2c9d1",
  },
  {
    type: "node.started",
    outcome: "ALLOW",
    time: "14:32:01.246Z",
    hash: "b8e1d4f7",
  },
  {
    type: "node.completed",
    outcome: "ALLOW",
    time: "14:32:02.086Z",
    hash: "c4a2b9e3",
  },
  {
    type: "node.started",
    outcome: "ALLOW",
    time: "14:32:02.100Z",
    hash: "d7f3c6a1",
  },
  {
    type: "node.completed",
    outcome: "ALLOW",
    time: "14:32:02.940Z",
    hash: "e2b5d8f4",
  },
  {
    type: "node.started",
    outcome: "ALLOW",
    time: "14:32:02.952Z",
    hash: "f6c1e4a7",
  },
  {
    type: "node.completed",
    outcome: "ALLOW",
    time: "14:32:02.984Z",
    hash: "a8d3b2c5",
  },
  {
    type: "node.started",
    outcome: "ALLOW",
    time: "14:32:02.990Z",
    hash: "b4e7c1d9",
  },
  {
    type: "node.completed",
    outcome: "ALLOW",
    time: "14:32:05.440Z",
    hash: "c2f5a8b6",
  },
  {
    type: "approval.requested",
    outcome: "HOLD",
    time: "14:32:05.450Z",
    hash: "d1a4c7e2",
  },
]

const statusIcon = (s: string) => {
  switch (s) {
    case "completed":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />
    case "failed":
      return <XCircle className="size-3.5 text-red-500" />
    case "waiting_approval":
      return <Clock className="size-3.5 text-amber-500" />
    case "pending":
      return <Clock className="size-3.5 text-muted-foreground" />
    default:
      return null
  }
}

const outcomeBadge = (o: string) => {
  const map: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline"
      label: string
    }
  > = {
    ALLOW: { variant: "default", label: "ALLOW" },
    DENY: { variant: "destructive", label: "DENY" },
    HOLD: { variant: "secondary", label: "HOLD" },
  }
  const b = map[o] ?? { variant: "outline" as const, label: o }
  return (
    <Badge variant={b.variant} className="text-[10px]">
      {b.label}
    </Badge>
  )
}

export default function ExecutionDetailPage() {
  const { executionId } = Route.useParams()
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Execution Detail</h1>
        <p className="font-mono text-xs text-muted-foreground">{executionId}</p>
      </div>

      <Card size="sm">
        <CardContent className="flex flex-wrap items-center gap-4 px-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Flow:</span>
            <span className="text-xs font-medium">Balance Alert v4</span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Trigger:</span>
            <Badge variant="outline" className="text-xs">
              user_message
            </Badge>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Badge variant="secondary" className="text-xs">
              waiting_approval
            </Badge>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">User:</span>
            <span className="font-mono text-xs">user_8291</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Started: 14:32:01</span>
            <span>Duration: 12.5s</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card size="sm" className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Node Timeline</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <div className="divide-y">
              {steps.map((step, i) => (
                <details key={step.id} className="group" open={i < 3}>
                  <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                    <step.icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {step.nodeName}
                        </span>
                        {step.status !== "pending" && statusIcon(step.status)}
                        {step.durationMs !== null && (
                          <span className="text-[11px] text-muted-foreground">
                            {step.durationMs < 1000
                              ? `${step.durationMs}ms`
                              : `${(step.durationMs / 1000).toFixed(1)}s`}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-10 py-2 text-xs">
                    {step.inputs && (
                      <div className="mb-1.5">
                        <p className="mb-0.5 font-medium text-muted-foreground">
                          Inputs
                        </p>
                        <pre className="overflow-auto rounded-md bg-muted/50 p-2 text-[11px]">
                          {JSON.stringify(step.inputs, null, 2)}
                        </pre>
                      </div>
                    )}
                    {step.outputs && (
                      <div>
                        <p className="mb-0.5 font-medium text-muted-foreground">
                          Outputs
                        </p>
                        <pre className="overflow-auto rounded-md bg-muted/50 p-2 text-[11px]">
                          {JSON.stringify(step.outputs, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm">Audit Events</CardTitle>
          </CardHeader>
          <CardContent className="px-0 py-0">
            <div className="divide-y">
              {auditEvents.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {e.time.slice(0, 12)}
                  </span>
                  <span className="flex-1 truncate">{e.type}</span>
                  {outcomeBadge(e.outcome)}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {e.hash}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
