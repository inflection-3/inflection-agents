import { Link, createFileRoute } from "@tanstack/react-router"
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import {
  ArrowLeft,
  BrainCircuit,
  CreditCard,
  Database,
  Globe,
  Grid3x3,
  Landmark,
  Layers,
  MoreHorizontal,
  Play,
  Redo2,
  Save,
  Search,
  Send,
  Undo2,
  Upload,
  UserCheck,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Hash,
  Settings,
  History,
} from "lucide-react"
import { useState, useCallback, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useSidebar } from "@/components/ui/sidebar"

export const Route = createFileRoute("/flows/$flowId")({
  component: FlowCanvasPage,
})

// ─── types ────────────────────────────────────────────────────────────────────

type DataType = "string" | "number" | "boolean" | "object" | "any"
type NodeKind =
  | "input"
  | "output"
  | "flow"
  | "connector"
  | "llm"
  | "hitl"
  | "memory"

interface CanvasNode extends Node {
  data: {
    label: string
    nodeType: NodeKind
    icon: string
    connectorName?: string
    inputs?: { name: string; type: DataType }[]
    outputs?: { name: string; type: DataType }[]
    requiresApproval?: boolean
  }
}

// ─── port + node colors ───────────────────────────────────────────────────────

const portColors: Record<DataType, string> = {
  string: "#60a5fa",
  number: "#34d399",
  boolean: "#fbbf24",
  object: "#a78bfa",
  any: "#9ca3af",
}

const nodeColors: Record<NodeKind, { border: string; bg: string }> = {
  input: { border: "#60a5fa", bg: "rgba(96,165,250,0.08)" },
  output: { border: "#34d399", bg: "rgba(52,211,153,0.08)" },
  connector: { border: "#a78bfa", bg: "rgba(167,139,250,0.08)" },
  flow: { border: "#fbbf24", bg: "rgba(251,191,36,0.08)" },
  hitl: { border: "#fb923c", bg: "rgba(251,146,60,0.08)" },
  llm: { border: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  memory: { border: "#22d3ee", bg: "rgba(34,211,238,0.08)" },
}

// ─── connector definitions ────────────────────────────────────────────────────

const connectorDefs: Record<
  string,
  {
    icon: string
    actions: {
      name: string
      label: string
      inputs?: { name: string; type: DataType }[]
      outputs?: { name: string; type: DataType }[]
      requiresApproval?: boolean
    }[]
  }
> = {
  Plaid: {
    icon: "Landmark",
    actions: [
      {
        name: "getBalance",
        label: "Get Balance",
        outputs: [
          { name: "balance", type: "number" },
          { name: "currency", type: "string" },
        ],
      },
      {
        name: "getTransactions",
        label: "Get Transactions",
        outputs: [{ name: "transactions", type: "object" }],
      },
      {
        name: "getIdentity",
        label: "Get Identity",
        outputs: [{ name: "identity", type: "object" }],
      },
      {
        name: "getIncome",
        label: "Get Income",
        outputs: [{ name: "income", type: "object" }],
      },
      {
        name: "getLiabilities",
        label: "Get Liabilities",
        outputs: [{ name: "liabilities", type: "object" }],
      },
    ],
  },
  Stripe: {
    icon: "CreditCard",
    actions: [
      {
        name: "createCharge",
        label: "Create Charge",
        inputs: [
          { name: "amount", type: "number" },
          { name: "currency", type: "string" },
        ],
        outputs: [{ name: "charge", type: "object" }],
        requiresApproval: true,
      },
      {
        name: "getCustomer",
        label: "Get Customer",
        inputs: [{ name: "customerId", type: "string" }],
        outputs: [{ name: "customer", type: "object" }],
      },
      {
        name: "createRefund",
        label: "Create Refund",
        inputs: [
          { name: "chargeId", type: "string" },
          { name: "amount", type: "number" },
        ],
        outputs: [{ name: "refund", type: "object" }],
        requiresApproval: true,
      },
    ],
  },
  "HTTP Request": {
    icon: "Globe",
    actions: [
      {
        name: "request",
        label: "HTTP Request",
        inputs: [
          { name: "url", type: "string" },
          { name: "method", type: "string" },
        ],
        outputs: [{ name: "response", type: "object" }],
      },
    ],
  },
  "Fincen API": {
    icon: "Globe",
    actions: [
      {
        name: "getFI",
        label: "Get Financial Institution",
        outputs: [{ name: "institution", type: "object" }],
      },
      {
        name: "searchEntity",
        label: "Search Entity",
        inputs: [{ name: "query", type: "string" }],
        outputs: [{ name: "results", type: "object" }],
      },
    ],
  },
  "Internal Loans": {
    icon: "Database",
    actions: [
      {
        name: "getLoan",
        label: "Get Loan",
        outputs: [{ name: "loan", type: "object" }],
      },
      {
        name: "createLoan",
        label: "Create Loan",
        inputs: [{ name: "amount", type: "number" }],
        outputs: [{ name: "loan", type: "object" }],
      },
      {
        name: "updateLoan",
        label: "Update Loan",
        inputs: [{ name: "loanId", type: "string" }],
        outputs: [{ name: "loan", type: "object" }],
      },
    ],
  },
}

// ─── icon map ─────────────────────────────────────────────────────────────────

const iconMap: Record<
  string,
  React.ComponentType<{ style?: React.CSSProperties; className?: string }>
> = {
  Landmark,
  CreditCard,
  Globe,
  Database,
  Play,
  Send,
  BrainCircuit,
  Layers,
  UserCheck,
}

function GitBranchIcon({
  style,
  className,
}: {
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  )
}

function getNodeIcon(iconName: string) {
  if (iconName === "GitBranch") return GitBranchIcon
  return iconMap[iconName] ?? Play
}

// ─── custom node component ────────────────────────────────────────────────────

function FlowNodeComponent({
  id,
  data,
  selected,
}: {
  id: string
  data: CanvasNode["data"]
  selected?: boolean
}) {
  const { setNodes } = useReactFlow()
  const [hovered, setHovered] = useState(false)
  const colors = nodeColors[data.nodeType]
  const NodeIcon = getNodeIcon(data.icon)

  const deleteNode = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNodes((nds) => nds.filter((n) => n.id !== id))
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        border: `2px solid ${selected ? "#6366f1" : colors.border}`,
        background: colors.bg,
        borderRadius: 10,
        padding: "10px 14px",
        minWidth: 160,
        maxWidth: 220,
        boxShadow: selected
          ? "0 0 0 3px rgba(99,102,241,0.25), 0 2px 8px rgba(0,0,0,0.1)"
          : "0 1px 4px rgba(0,0,0,0.08)",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      {/* delete button */}
      {(hovered || selected) && (
        <button
          onClick={deleteNode}
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#ef4444",
            border: "2px solid #fff",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            lineHeight: 1,
            zIndex: 10,
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        >
          ×
        </button>
      )}
      {/* input handles */}
      {data.inputs?.map((port, pi) => (
        <Handle
          key={`in-${port.name}`}
          type="target"
          position={Position.Left}
          id={port.name}
          style={{
            top: 16 + pi * 18,
            background: portColors[port.type],
            width: 10,
            height: 10,
            border: "2px solid #fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      ))}

      {/* node header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.border + "20",
            flexShrink: 0,
          }}
        >
          <NodeIcon
            style={{ width: 14, height: 14, color: colors.border }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              margin: 0,
              lineHeight: 1.3,
              color: "#111827",
            }}
          >
            {data.label}
          </p>
          {data.connectorName && (
            <p
              style={{
                fontSize: 10,
                color: "#6b7280",
                margin: "1px 0 0",
              }}
            >
              {data.connectorName}
            </p>
          )}
        </div>
        {data.requiresApproval && (
          <span
            style={{
              fontSize: 9,
              color: "#ea580c",
              background: "rgba(251,146,60,0.15)",
              padding: "1px 5px",
              borderRadius: 4,
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            HITL
          </span>
        )}
      </div>

      {/* port chips */}
      {(data.inputs?.length || data.outputs?.length) ? (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${colors.border}20`,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {data.outputs?.map((p) => (
            <span
              key={p.name}
              style={{
                fontSize: 9,
                padding: "1px 5px",
                borderRadius: 4,
                background: portColors[p.type] + "20",
                color: portColors[p.type],
                fontWeight: 500,
                border: `1px solid ${portColors[p.type]}40`,
              }}
            >
              {p.name}
            </span>
          ))}
        </div>
      ) : null}

      {/* output handles */}
      {data.outputs?.map((port, pi) => (
        <Handle
          key={`out-${port.name}`}
          type="source"
          position={Position.Right}
          id={port.name}
          style={{
            top: 16 + pi * 18,
            background: portColors[port.type],
            width: 10,
            height: 10,
            border: "2px solid #fff",
            boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }}
        />
      ))}
    </div>
  )
}

const nodeTypes = { custom: FlowNodeComponent }

// ─── initial data ─────────────────────────────────────────────────────────────

const initialNodes: CanvasNode[] = [
  {
    id: "n1",
    type: "custom",
    position: { x: 80, y: 160 },
    data: {
      label: "Input",
      nodeType: "input",
      icon: "Play",
      outputs: [{ name: "output", type: "any" }],
    },
  },
  {
    id: "n2",
    type: "custom",
    position: { x: 300, y: 100 },
    data: {
      label: "getBalance",
      nodeType: "connector",
      icon: "Landmark",
      connectorName: "Plaid",
      inputs: [{ name: "input", type: "any" }],
      outputs: [
        { name: "balance", type: "number" },
        { name: "currency", type: "string" },
      ],
    },
  },
  {
    id: "n3",
    type: "custom",
    position: { x: 540, y: 100 },
    data: {
      label: "If / Else",
      nodeType: "flow",
      icon: "GitBranch",
      inputs: [{ name: "input", type: "any" }],
      outputs: [
        { name: "true", type: "any" },
        { name: "false", type: "any" },
      ],
    },
  },
  {
    id: "n4",
    type: "custom",
    position: { x: 760, y: 40 },
    data: {
      label: "Send Email",
      nodeType: "connector",
      icon: "Send",
      connectorName: "SendGrid",
      inputs: [{ name: "input", type: "any" }],
      outputs: [{ name: "output", type: "any" }],
    },
  },
  {
    id: "n5",
    type: "custom",
    position: { x: 760, y: 240 },
    data: {
      label: "Output",
      nodeType: "output",
      icon: "Send",
      inputs: [{ name: "input", type: "any" }],
    },
  },
  {
    id: "n6",
    type: "custom",
    position: { x: 300, y: 320 },
    data: {
      label: "HITL",
      nodeType: "hitl",
      icon: "UserCheck",
      inputs: [{ name: "data", type: "any" }],
      outputs: [
        { name: "approved", type: "boolean" },
        { name: "context", type: "object" },
      ],
    },
  },
]

const initialEdges: Edge[] = [
  {
    id: "e1",
    source: "n1",
    target: "n2",
    sourceHandle: "output",
    targetHandle: "input",
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  },
  {
    id: "e2",
    source: "n2",
    target: "n3",
    sourceHandle: "balance",
    targetHandle: "input",
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  },
  {
    id: "e3",
    source: "n3",
    target: "n4",
    sourceHandle: "true",
    targetHandle: "input",
    label: "true",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 12,
      height: 12,
      color: "#10b981",
    },
    style: { stroke: "#10b981", strokeWidth: 1.5 },
  },
  {
    id: "e4",
    source: "n3",
    target: "n5",
    sourceHandle: "false",
    targetHandle: "input",
    label: "false",
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
    style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  },
  {
    id: "e5",
    source: "n2",
    target: "n6",
    sourceHandle: "balance",
    targetHandle: "data",
    markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
    style: { stroke: "#94a3b8", strokeWidth: 1.5, strokeDasharray: "4 3" },
  },
]

const versions = [
  {
    version: 4,
    stage: "production",
    by: "Jane Doe",
    time: "3 hours ago",
    msg: "Increased threshold to $500",
  },
  {
    version: 3,
    stage: "archived",
    by: "Jane Doe",
    time: "2 days ago",
    msg: "Added HITL gate",
  },
  {
    version: 2,
    stage: "archived",
    by: "John Smith",
    time: "5 days ago",
    msg: "Fixed Plaid env config",
  },
  {
    version: 1,
    stage: "archived",
    by: "Jane Doe",
    time: "2 weeks ago",
    msg: "Initial version",
  },
]

// ─── sidebar sections ─────────────────────────────────────────────────────────

const flowNodes = [
  { name: "Input", icon: "Play", nodeType: "input" as NodeKind },
  { name: "Output", icon: "Send", nodeType: "output" as NodeKind },
  { name: "If / Else", icon: "GitBranch", nodeType: "flow" as NodeKind },
  { name: "LLM", icon: "BrainCircuit", nodeType: "llm" as NodeKind },
  { name: "Memory", icon: "Database", nodeType: "memory" as NodeKind },
  { name: "Variable", icon: "Layers", nodeType: "memory" as NodeKind },
  { name: "HITL", icon: "UserCheck", nodeType: "hitl" as NodeKind },
]

const nativeConnectors = ["Plaid", "Stripe", "HTTP Request"]
const yourConnectors = ["Fincen API", "Internal Loans"]

// ─── inspector content ────────────────────────────────────────────────────────

function NodeInspector({ node }: { node: CanvasNode }) {
  const d = node.data
  if (d.nodeType === "connector") {
    return (
      <>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Connector
          </p>
          <p className="text-sm">{d.connectorName}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Action
          </p>
          <p className="font-mono text-sm">{d.label}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Credential
          </p>
          <Select defaultValue="production">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production (****a1b2)</SelectItem>
              <SelectItem value="sandbox">Sandbox (****test)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Parameters
          </p>
          {d.inputs?.map((inp) => (
            <div key={inp.name} className="mb-2">
              <label className="mb-1 flex items-center gap-1 text-[11px] font-medium">
                {inp.name}
                <span
                  className="rounded px-1 text-[9px] font-normal"
                  style={{
                    background: portColors[inp.type] + "20",
                    color: portColors[inp.type],
                  }}
                >
                  {inp.type}
                </span>
              </label>
              <Input
                className="h-7 font-mono text-xs"
                placeholder={`{{input.${inp.name}}}`}
              />
            </div>
          ))}
        </div>
      </>
    )
  }
  if (d.nodeType === "llm") {
    return (
      <>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Model
          </p>
          <Select defaultValue="claude-sonnet">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude-sonnet">Claude Sonnet 4.6</SelectItem>
              <SelectItem value="claude-opus">Claude Opus 4.7</SelectItem>
              <SelectItem value="gpt-4o">GPT-4o</SelectItem>
              <SelectItem value="gemini">Gemini 2.0 Flash</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Temperature
          </p>
          <Input
            className="h-7 text-xs"
            type="number"
            defaultValue="0.2"
            min={0}
            max={2}
            step={0.1}
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            System Prompt
          </p>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-input bg-muted/30 px-2 py-1.5 font-mono text-[11px] leading-relaxed"
            defaultValue="You are analyzing a bank account balance. Alert the user if their checking balance drops below the threshold of $500."
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Max Tokens
          </p>
          <Input className="h-7 text-xs" type="number" defaultValue="1024" />
        </div>
      </>
    )
  }
  if (d.nodeType === "flow") {
    return (
      <>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Condition
          </p>
          <Input
            className="h-7 font-mono text-xs"
            defaultValue="balance < threshold"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            True branch label
          </p>
          <Input className="h-7 text-xs" defaultValue="Below threshold" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            False branch label
          </p>
          <Input className="h-7 text-xs" defaultValue="Above threshold" />
        </div>
      </>
    )
  }
  if (d.nodeType === "hitl") {
    return (
      <>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Approval message
          </p>
          <textarea
            className="min-h-[60px] w-full rounded-md border border-input bg-muted/30 px-2 py-1.5 text-[11px] leading-relaxed"
            defaultValue="Please review this action before it is processed."
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            On timeout
          </p>
          <Select defaultValue="escalate">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cancel">Cancel Execution</SelectItem>
              <SelectItem value="auto-approve">Auto-Approve</SelectItem>
              <SelectItem value="escalate">Escalate to Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Timeout (minutes)
          </p>
          <Input className="h-7 text-xs" type="number" defaultValue="60" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Reviewers
          </p>
          <Input className="h-7 text-xs" defaultValue="jane@acmecorp.com" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs">Require all reviewers</span>
          <Switch />
        </div>
      </>
    )
  }
  if (d.nodeType === "memory") {
    return (
      <>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Operation
          </p>
          <Select defaultValue="read">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="write">Write</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scope
          </p>
          <Select defaultValue="user">
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="workspace">Workspace</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Key
          </p>
          <Input
            className="h-7 font-mono text-xs"
            defaultValue="alert_threshold_"
          />
        </div>
      </>
    )
  }
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Description
      </p>
      <Input className="h-7 text-xs" defaultValue={d.label} />
    </div>
  )
}

// ─── inner canvas (needs ReactFlowProvider) ───────────────────────────────────

function Canvas({ flowId }: { flowId: string }) {
  const { screenToFlowPosition } = useReactFlow()
  const { setOpen } = useSidebar()

  const isBlank = flowId === "blank"
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(
    isBlank ? [] : (initialNodes as CanvasNode[])
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(isBlank ? [] : initialEdges)
  const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null)
  const [sheetTab, setSheetTab] = useState<"config" | "versions">("config")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [gridOn, setGridOn] = useState(true)
  const [expandedConnectors, setExpandedConnectors] = useState<Set<string>>(
    new Set(["Plaid", "Fincen API"])
  )
  const [saved, setSaved] = useState(false)

  // collapse sidebar when canvas opens, restore on leave
  useEffect(() => {
    setOpen(false)
    return () => setOpen(true)
  }, [setOpen])

  const templateNames: Record<string, string> = {
    "1": "Balance Alert",
    "3": "Payment Approval",
    "balance-alert": "Balance Alert",
    "transaction-summary": "Transaction Summary",
    "payment-approval": "Payment Approval",
    "custom-connector-query": "Custom Connector Query",
    "scheduled-report": "Scheduled Financial Report",
  }
  const flowName = templateNames[flowId] ?? "Untitled Flow"

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
            },
            style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          },
          eds
        )
      ),
    [setEdges]
  )

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      setSelectedNode(node as CanvasNode)
      setSheetTab("config")
      setSheetOpen(true)
    },
    []
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
    setSheetOpen(false)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const nodeType = e.dataTransfer.getData("nodeType")
      const nodeLabel = e.dataTransfer.getData("nodeLabel")
      const nodeIcon = e.dataTransfer.getData("nodeIcon")
      const connectorName = e.dataTransfer.getData("connectorName") || undefined
      const requiresApproval =
        e.dataTransfer.getData("requiresApproval") === "true"

      if (!nodeType || !nodeLabel) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })

      const newNode: CanvasNode = {
        id: `n-${Date.now()}`,
        type: "custom",
        position,
        data: {
          label: nodeLabel,
          nodeType: nodeType as NodeKind,
          icon: nodeIcon || "Play",
          connectorName,
          requiresApproval,
          inputs: [{ name: "input", type: "any" }],
          outputs: [{ name: "output", type: "any" }],
        },
      }
      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }, [])

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const openVersions = () => {
    setSheetTab("versions")
    setSheetOpen(true)
  }

  const toggleConnector = (name: string) => {
    setExpandedConnectors((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function dragStart(
    e: React.DragEvent,
    opts: {
      nodeType: NodeKind
      label: string
      icon: string
      connectorName?: string
      requiresApproval?: boolean
    }
  ) {
    e.dataTransfer.setData("nodeType", opts.nodeType)
    e.dataTransfer.setData("nodeLabel", opts.label)
    e.dataTransfer.setData("nodeIcon", opts.icon)
    e.dataTransfer.setData("connectorName", opts.connectorName ?? "")
    e.dataTransfer.setData(
      "requiresApproval",
      opts.requiresApproval ? "true" : "false"
    )
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div
    className="w-full h-full flex flex-col"
      
    >
      {/* ── toolbar ── */}
      <div
        style={{
          display: "flex",
          height: 44,
          alignItems: "center",
          gap: 6,
          padding: "0 12px",
          borderBottom: "1px solid hsl(var(--border))",
          flexShrink: 0,
          background: "hsl(var(--background))",
        }}
      >
        <Button variant="ghost" size="icon-xs" asChild>
          <Link to="/flows">
            <ArrowLeft style={{ width: 14, height: 14 }} />
          </Link>
        </Button>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <input
          defaultValue={flowName}
          style={{
            height: 28,
            width: 180,
            background: "transparent",
            fontSize: 14,
            fontWeight: 600,
            outline: "none",
            border: "1px solid transparent",
            padding: "0 8px",
            borderRadius: 6,
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "hsl(var(--input))"
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "transparent"
          }}
        />
        <Badge variant="default" style={{ height: 18, fontSize: 10 }}>
          Production
        </Badge>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="icon-xs" title="Undo (⌘Z)">
          <Undo2 style={{ width: 14, height: 14 }} />
        </Button>
        <Button variant="ghost" size="icon-xs" title="Redo (⌘Y)">
          <Redo2 style={{ width: 14, height: 14 }} />
        </Button>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <Button
          variant={gridOn ? "secondary" : "ghost"}
          size="icon-xs"
          onClick={() => setGridOn(!gridOn)}
          title="Toggle grid"
        >
          <Grid3x3 style={{ width: 14, height: 14 }} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={openVersions}
          title="Version history"
        >
          <History style={{ width: 14, height: 14 }} />
        </Button>
        <Separator orientation="vertical" style={{ height: 16 }} />
        <Button
          size="xs"
          variant="outline"
          onClick={handleSave}
          style={
            saved
              ? {
                  color: "#059669",
                  borderColor: "#059669",
                }
              : {}
          }
        >
          <Save style={{ width: 12, height: 12 }} />
          {saved ? "Saved!" : "Save"}
        </Button>
        <Button size="xs">
          <Upload style={{ width: 12, height: 12 }} /> Publish
        </Button>
      </div>

      {/* ── 2-panel body (no right panel — sheet instead) ── */}
      <div className="" style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* left sidebar */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            borderRight: "1px solid hsl(var(--border))",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: "hsl(var(--background))",
          }}
        >
          <div style={{ padding: "8px 8px 4px" }}>
            <div style={{ position: "relative" }}>
              <Search
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 12,
                  height: 12,
                  color: "hsl(var(--muted-foreground))",
                }}
              />
              <Input
                placeholder="Search nodes..."
                style={{ height: 28, paddingLeft: 28, fontSize: 12 }}
              />
            </div>
          </div>

          <ScrollArea style={{ flex: 1, padding: "4px 6px 8px" }}>
            {/* Your connectors */}
            <SidebarSection
              label="Your Connectors"
              defaultOpen
            >
              {yourConnectors.map((name) => {
                const def = connectorDefs[name]
                const isExpanded = expandedConnectors.has(name)
                const Icon = getNodeIcon(def.icon)
                return (
                  <div key={name} style={{ marginBottom: 1 }}>
                    <button
                      onClick={() => toggleConnector(name)}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "inherit",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        ;(
                          e.currentTarget as HTMLElement
                        ).style.background = "hsl(var(--muted))"
                      }}
                      onMouseLeave={(e) => {
                        ;(
                          e.currentTarget as HTMLElement
                        ).style.background = "transparent"
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown
                          style={{
                            width: 11,
                            height: 11,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        />
                      ) : (
                        <ChevronRight
                          style={{
                            width: 11,
                            height: 11,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        />
                      )}
                      <Icon
                        style={{
                          width: 13,
                          height: 13,
                          color: "hsl(var(--muted-foreground))",
                        }}
                      />
                      <span style={{ flex: 1 }}>{name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {def.actions.length}
                      </span>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          marginLeft: 20,
                          borderLeft: "1px solid hsl(var(--border))",
                          paddingLeft: 8,
                        }}
                      >
                        {def.actions.map((action) => (
                          <div
                            key={action.name}
                            draggable
                            onDragStart={(e) =>
                              dragStart(e, {
                                nodeType: "connector",
                                label: action.label,
                                icon: def.icon,
                                connectorName: name,
                                requiresApproval: action.requiresApproval,
                              })
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 6px",
                              borderRadius: 4,
                              cursor: "grab",
                              fontSize: 11,
                              userSelect: "none",
                            }}
                            onMouseEnter={(e) => {
                              ;(
                                e.currentTarget as HTMLElement
                              ).style.background = "hsl(var(--muted))"
                            }}
                            onMouseLeave={(e) => {
                              ;(
                                e.currentTarget as HTMLElement
                              ).style.background = "transparent"
                            }}
                          >
                            <GripVertical
                              style={{
                                width: 10,
                                height: 10,
                                color: "hsl(var(--muted-foreground))",
                                opacity: 0.5,
                              }}
                            />
                            <span style={{ flex: 1 }}>{action.label}</span>
                            {action.requiresApproval && (
                              <span
                                style={{
                                  fontSize: 9,
                                  color: "#ea580c",
                                  background: "rgba(251,146,60,0.15)",
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                  fontWeight: 600,
                                }}
                              >
                                HITL
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </SidebarSection>

            {/* Flow control nodes */}
            <SidebarSection label="Flow Control" defaultOpen>
              {flowNodes.slice(0, 3).map((item) => (
                <DraggableNode
                  key={item.name}
                  item={item}
                  onDragStart={dragStart}
                />
              ))}
            </SidebarSection>

            <SidebarSection label="AI" defaultOpen>
              {flowNodes.slice(3, 4).map((item) => (
                <DraggableNode
                  key={item.name}
                  item={item}
                  onDragStart={dragStart}
                />
              ))}
            </SidebarSection>

            <SidebarSection label="Memory">
              {flowNodes.slice(4, 6).map((item) => (
                <DraggableNode
                  key={item.name}
                  item={item}
                  onDragStart={dragStart}
                />
              ))}
            </SidebarSection>

            <SidebarSection label="HITL">
              {flowNodes.slice(6).map((item) => (
                <DraggableNode
                  key={item.name}
                  item={item}
                  onDragStart={dragStart}
                />
              ))}
            </SidebarSection>

            {/* Native connectors */}
            <SidebarSection label="Native Connectors">
              {nativeConnectors.map((name) => {
                const def = connectorDefs[name]
                const isExpanded = expandedConnectors.has(name)
                const Icon = getNodeIcon(def.icon)
                return (
                  <div key={name} style={{ marginBottom: 1 }}>
                    <button
                      onClick={() => toggleConnector(name)}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 8px",
                        borderRadius: 6,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "inherit",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        ;(
                          e.currentTarget as HTMLElement
                        ).style.background = "hsl(var(--muted))"
                      }}
                      onMouseLeave={(e) => {
                        ;(
                          e.currentTarget as HTMLElement
                        ).style.background = "transparent"
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown
                          style={{
                            width: 11,
                            height: 11,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        />
                      ) : (
                        <ChevronRight
                          style={{
                            width: 11,
                            height: 11,
                            color: "hsl(var(--muted-foreground))",
                          }}
                        />
                      )}
                      <Icon
                        style={{
                          width: 13,
                          height: 13,
                          color: "hsl(var(--muted-foreground))",
                        }}
                      />
                      <span style={{ flex: 1 }}>{name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "hsl(var(--muted-foreground))",
                        }}
                      >
                        {def.actions.length}
                      </span>
                    </button>
                    {isExpanded && (
                      <div
                        style={{
                          marginLeft: 20,
                          borderLeft: "1px solid hsl(var(--border))",
                          paddingLeft: 8,
                        }}
                      >
                        {def.actions.map((action) => (
                          <div
                            key={action.name}
                            draggable
                            onDragStart={(e) =>
                              dragStart(e, {
                                nodeType: "connector",
                                label: action.label,
                                icon: def.icon,
                                connectorName: name,
                                requiresApproval: action.requiresApproval,
                              })
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 6px",
                              borderRadius: 4,
                              cursor: "grab",
                              fontSize: 11,
                              userSelect: "none",
                            }}
                            onMouseEnter={(e) => {
                              ;(
                                e.currentTarget as HTMLElement
                              ).style.background = "hsl(var(--muted))"
                            }}
                            onMouseLeave={(e) => {
                              ;(
                                e.currentTarget as HTMLElement
                              ).style.background = "transparent"
                            }}
                          >
                            <GripVertical
                              style={{
                                width: 10,
                                height: 10,
                                color: "hsl(var(--muted-foreground))",
                                opacity: 0.5,
                              }}
                            />
                            <span style={{ flex: 1 }}>{action.label}</span>
                            {action.requiresApproval && (
                              <span
                                style={{
                                  fontSize: 9,
                                  color: "#ea580c",
                                  background: "rgba(251,146,60,0.15)",
                                  padding: "1px 4px",
                                  borderRadius: 3,
                                  fontWeight: 600,
                                }}
                              >
                                HITL
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </SidebarSection>
          </ScrollArea>
        </div>

        {/* canvas — full width */}
        <div
          style={{ flex: 1, minWidth: 0, position: "relative" }}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            style={{ background: "hsl(var(--background))" }}
            proOptions={{ hideAttribution: true }}
            onNodesDelete={(params) => {
              console.log(params)
            }}
          >
            {gridOn && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1}
                color="hsl(var(--border))"
              />
            )}
            <Controls
              style={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
              showZoom
              showFitView
              showInteractive={false}
            />
          </ReactFlow>

          {/* floating hint */}
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              fontSize: 10,
              color: "hsl(var(--muted-foreground))",
              background: "hsl(var(--background)/0.9)",
              padding: "3px 10px",
              borderRadius: 6,
              border: "1px solid hsl(var(--border))",
              pointerEvents: "none",
            }}
          >
            Drag nodes · Connect ports · Click to configure
          </div>
        </div>
      </div>

      {/* ── inspector / versions sheet ── */}
      <Sheet  open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="flex w-80 flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm">
              {sheetTab === "config" && selectedNode
                ? `Configure — ${selectedNode.data.label}`
                : "Version History"}
            </SheetTitle>
          </SheetHeader>

          <Tabs
            value={sheetTab}
            onValueChange={(v) => setSheetTab(v as "config" | "versions")}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="border-b px-4 pt-2">
              <TabsList variant="line" className="h-8 w-full">
                <TabsTrigger value="config" className="gap-1 text-xs">
                  <Settings className="size-3" /> Configure
                </TabsTrigger>
                <TabsTrigger value="versions" className="gap-1 text-xs">
                  <History className="size-3" /> Versions{" "}
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {versions.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="config"
              className="m-0 flex-1 overflow-auto"
            >
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 px-4 py-4">
                  {selectedNode ? (
                    <>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const Icon = getNodeIcon(selectedNode.data.icon)
                          return (
                            <Icon
                              style={{
                                width: 14,
                                height: 14,
                                color:
                                  nodeColors[selectedNode.data.nodeType]
                                    .border,
                              }}
                            />
                          )
                        })()}
                        <span className="text-sm font-semibold">
                          {selectedNode.data.label}
                        </span>
                        {selectedNode.data.connectorName && (
                          <span className="text-xs text-muted-foreground">
                            · {selectedNode.data.connectorName}
                          </span>
                        )}
                      </div>
                      <Separator />
                      <NodeInspector node={selectedNode} />
                      <Separator />
                      <Button size="sm" variant="outline" className="w-full">
                        <Play className="size-3" /> Test this node
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                      <Hash
                        style={{
                          width: 32,
                          height: 32,
                          color: "hsl(var(--muted-foreground))",
                          opacity: 0.3,
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Click a node to configure it
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="versions"
              className="m-0 flex-1 overflow-auto"
            >
              <div>
                {versions.map((v) => (
                  <div
                    key={v.version}
                    className="group border-b px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">
                          v{v.version}
                        </span>
                        {v.stage === "production" ? (
                          <Badge
                            variant="default"
                            className="h-4 px-1 text-[9px]"
                          >
                            Live
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-4 px-1 text-[9px]"
                          >
                            Archived
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal style={{ width: 12 }} />
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {v.msg}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground opacity-70">
                      {v.by} · {v.time}
                    </p>
                    {v.stage !== "production" && (
                      <div className="mt-2 flex gap-2 opacity-0 group-hover:opacity-100">
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-5 text-[10px]"
                        >
                          View diff
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="h-5 text-[10px]"
                        >
                          Rollback
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─── small helper components ──────────────────────────────────────────────────

function SidebarSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 4,
          padding: "4px 6px",
          borderRadius: 4,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "hsl(var(--muted-foreground))",
          textAlign: "left",
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color =
            "hsl(var(--foreground))"
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color =
            "hsl(var(--muted-foreground))"
        }}
      >
        {open ? (
          <ChevronDown style={{ width: 10, height: 10, flexShrink: 0 }} />
        ) : (
          <ChevronRight style={{ width: 10, height: 10, flexShrink: 0 }} />
        )}
        {label}
      </button>
      {open && children}
    </div>
  )
}

function DraggableNode({
  item,
  onDragStart,
}: {
  item: { name: string; icon: string; nodeType: NodeKind }
  onDragStart: (
    e: React.DragEvent,
    opts: { nodeType: NodeKind; label: string; icon: string }
  ) => void
}) {
  const Icon = getNodeIcon(item.icon)
  const color = nodeColors[item.nodeType]
  return (
    <div
      draggable
      onDragStart={(e) =>
        onDragStart(e, {
          nodeType: item.nodeType,
          label: item.name,
          icon: item.icon,
        })
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        borderRadius: 6,
        cursor: "grab",
        fontSize: 12,
        userSelect: "none",
        marginBottom: 1,
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = "hsl(var(--muted))"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.background = "transparent"
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: color.border + "18",
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: 12, height: 12, color: color.border }} />
      </div>
      <span style={{ flex: 1 }}>{item.name}</span>
      <GripVertical
        style={{
          width: 12,
          height: 12,
          color: "hsl(var(--muted-foreground))",
          opacity: 0.4,
        }}
      />
    </div>
  )
}

// ─── page (wraps inner canvas in ReactFlowProvider) ───────────────────────────

export default function FlowCanvasPage() {
  const { flowId } = Route.useParams()
  return (
    <ReactFlowProvider>
      <Canvas flowId={flowId} />
    </ReactFlowProvider>
  )
}
