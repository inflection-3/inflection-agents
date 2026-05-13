import { createFileRoute } from "@tanstack/react-router"
import {
  Clock,
  Eye,
  Mail,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  UserPlus,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const Route = createFileRoute("/settings/team")({ component: TeamPage })

const members = [
  {
    name: "Jane Doe",
    email: "jane@acmecorp.com",
    role: "Admin",
    lastActive: "Now",
    mfa: true,
    initials: "JD",
  },
  {
    name: "John Smith",
    email: "john@acmecorp.com",
    role: "Editor",
    lastActive: "45 min ago",
    mfa: true,
    initials: "JS",
  },
  {
    name: "Alice Chen",
    email: "alice@acmecorp.com",
    role: "Editor",
    lastActive: "2 hours ago",
    mfa: false,
    initials: "AC",
  },
  {
    name: "Bob Wilson",
    email: "bob@acmecorp.com",
    role: "Viewer",
    lastActive: "1 day ago",
    mfa: false,
    initials: "BW",
  },
]

const pendingInvites = [
  { email: "carol@acmecorp.com", role: "Editor", sent: "2 days ago" },
]

const roleIcon = (r: string) => {
  switch (r) {
    case "Admin":
      return <ShieldCheck className="size-3 text-violet-500" />
    case "Editor":
      return <Shield className="size-3 text-blue-500" />
    case "Viewer":
      return <Eye className="size-3 text-muted-foreground" />
    default:
      return null
  }
}

export default function TeamPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage workspace members and permissions.
          </p>
        </div>
        <Button size="sm">
          <UserPlus className="size-3.5" /> Invite Member
        </Button>
      </div>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Members</CardTitle>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>MFA</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.email}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="size-6">
                        <AvatarFallback className="text-[10px]">
                          {m.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{m.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.email}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {roleIcon(m.role)}
                      <span className="text-xs">{m.role}</span>
                    </div>
                  </TableCell>
                  <TableCell className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {m.lastActive}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={m.mfa ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {m.mfa ? "Enabled" : "Not set"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Change Role</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm">Invite Members</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="colleague@acmecorp.com"
              className="h-8 flex-1 text-xs"
            />
            <Select defaultValue="editor">
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm">
              <Mail className="size-3.5" /> Send Invite
            </Button>
          </div>
          {pendingInvites.map((inv) => (
            <div
              key={inv.email}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" />
                <span className="text-sm">{inv.email}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {inv.role}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Sent {inv.sent}
                </span>
                <Button variant="ghost" size="icon-xs" className="size-6">
                  <MoreHorizontal className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
