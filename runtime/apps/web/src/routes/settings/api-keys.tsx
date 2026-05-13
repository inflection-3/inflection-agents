import { createFileRoute } from "@tanstack/react-router"
import { Copy, Globe, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const Route = createFileRoute("/settings/api-keys")({
  component: ApiKeysPage,
})

const keys = [
  {
    name: "Production API",
    key: "inf_live_****a1b2",
    created: "Jan 15, 2026",
    lastUsed: "2 min ago",
    permissions: "Read+Write",
  },
  {
    name: "Staging API",
    key: "inf_test_****c3d4",
    created: "Mar 3, 2026",
    lastUsed: "1 day ago",
    permissions: "Read-only",
  },
  {
    name: "CI/CD Pipeline",
    key: "inf_live_****e5f6",
    created: "Apr 22, 2026",
    lastUsed: "Never",
    permissions: "Read+Write",
  },
]

const origins = ["https://app.acmecorp.com", "https://dashboard.acmecorp.com"]

export default function ApiKeysPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Manage keys for API access and embedding.
          </p>
        </div>
        <Button size="sm">
          <Plus className="size-3.5" /> Generate Key
        </Button>
      </div>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">API Keys</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.key}>
                  <TableCell className="text-sm font-medium">
                    {k.name}
                  </TableCell>
                  <TableCell className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                    {k.key}{" "}
                    <Button variant="ghost" size="icon-xs" className="size-5">
                      <Copy className="size-2.5" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.created}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.lastUsed}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        k.permissions === "Read+Write" ? "default" : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {k.permissions}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-6 text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm">Embed Credentials</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium">Workspace ID</label>
              <div className="flex items-center gap-1">
                <Input
                  className="h-7 font-mono text-xs"
                  value="ws_abc123def456"
                  readOnly
                />
                <Button variant="ghost" size="icon-xs" className="size-7">
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium">Public Key</label>
              <div className="flex items-center gap-1">
                <Input
                  className="h-7 font-mono text-xs"
                  value="pk_live_8f3a2b..."
                  readOnly
                />
                <Button variant="ghost" size="icon-xs" className="size-7">
                  <Copy className="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium">
                Allowed Embed Origins
              </label>
              <Button size="xs" variant="outline">
                <Plus className="size-3" /> Add
              </Button>
            </div>
            {origins.map((origin) => (
              <div
                key={origin}
                className="flex items-center justify-between rounded-md border px-2 py-1.5"
              >
                <span className="font-mono text-xs">{origin}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 text-destructive"
                >
                  <Trash2 className="size-2.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button size="sm" variant="destructive" className="w-fit">
            <RefreshCw className="size-3.5" /> Rotate Public Key
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
