import { createFileRoute } from "@tanstack/react-router"
import {
  AlertTriangle,
  Ban,
  Clock,
  CreditCard,
  DollarSign,
  Landmark,
  Power,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const Route = createFileRoute("/settings/guardrails")({
  component: GuardrailsPage,
})

const allowlistActions = [
  {
    connector: "Plaid",
    icon: Landmark,
    actions: ["getBalance", "getTransactions", "getIdentity", "getIncome"],
  },
  {
    connector: "Stripe",
    icon: CreditCard,
    actions: ["createCharge", "getCustomer", "getInvoice"],
  },
]

const denylistActions = [
  { connector: "Stripe", icon: CreditCard, action: "createRefund" },
  { connector: "Plaid", icon: Landmark, action: "exchangePublicToken" },
]

const hitlActions = [
  { connector: "Stripe", icon: CreditCard, action: "createCharge" },
  { connector: "Stripe", icon: CreditCard, action: "createRefund" },
]

export default function GuardrailsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Guardrails</h1>
        <p className="text-sm text-muted-foreground">
          Runtime policies enforced on every execution.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card size="sm">
          <CardHeader className="flex-row items-center justify-between pb-1">
            <CardTitle className="text-sm">Action Allowlist</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              8 actions allowed
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-3">
            {allowlistActions.map((c) => (
              <div key={c.connector} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <c.icon className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{c.connector}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.actions.map((a) => (
                    <Badge
                      key={a}
                      variant="default"
                      className="font-mono text-[10px]"
                    >
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <Ban className="size-4 text-red-500" />
              <CardTitle className="text-sm">Action Denylist</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-3">
            {denylistActions.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/20"
              >
                <c.icon className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-red-600 dark:text-red-400">
                  {c.connector}.{c.action}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <CardTitle className="text-sm">Require Approval For</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-3">
            {hitlActions.map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <c.icon className="size-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {c.connector}.{c.action}
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card size="sm">
            <CardHeader className="pb-1">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm">Rate Limits</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Per user / day</span>
                  <span className="text-[10px] text-muted-foreground">
                    Max executions
                  </span>
                </div>
                <Input className="h-7 w-24 text-xs" defaultValue="1000" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">Per user / hour</span>
                  <span className="text-[10px] text-muted-foreground">
                    Max executions
                  </span>
                </div>
                <Input className="h-7 w-24 text-xs" defaultValue="100" />
              </div>
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader className="pb-1">
              <div className="flex items-center gap-2">
                <DollarSign className="size-4 text-muted-foreground" />
                <CardTitle className="text-sm">Budget Cap</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    Max LLM cost / execution
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    USD cents
                  </span>
                </div>
                <Input className="h-7 w-24 text-xs" defaultValue="50" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs">On exceed:</span>
                <Select defaultValue="cancel">
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cancel">Cancel</SelectItem>
                    <SelectItem value="warn">Warn & Continue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card size="sm" className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className="size-4 text-red-500" />
                <CardTitle className="text-sm text-red-600 dark:text-red-400">
                  Kill Switch
                </CardTitle>
              </div>
              <Switch />
            </div>
          </CardHeader>
          <CardContent className="px-3">
            <p className="text-xs text-muted-foreground">
              When ON, all executions are blocked immediately. A red banner will
              be shown at the top of every dashboard page.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
