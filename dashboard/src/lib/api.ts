const API_BASE = "http://localhost:3001"

function getToken() {
  return localStorage.getItem("accessToken")
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> | undefined),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(url, { ...opts, headers })

  if (res.status === 401) {
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    window.location.href = "/login"
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const get = <T>(path: string) => api<T>(path, { method: "GET" })
export const post = <T>(path: string, body: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(body) })
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body: JSON.stringify(body) })
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" })
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: "PUT", body: JSON.stringify(body) })

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("accessToken", access)
  localStorage.setItem("refreshToken", refresh)
}

export function clearTokens() {
  localStorage.removeItem("accessToken")
  localStorage.removeItem("refreshToken")
}

// ─── Types derived from backend schema ───────────────────────────────────────

export interface Agent {
  id: string
  developerId: string
  name: string
  description: string | null
  webhookUrl: string | null
  status: "active" | "suspended" | "deleted"
  createdAt: string // ISO date from SQLite timestamp
  updatedAt: string
}

export interface ApiKey {
  id: string
  agentId: string
  keyPrefix: string
  mode: "live" | "test"
  status: "active" | "revoked"
  lastUsedAt: string | null
  createdAt: string
}

export interface Connector {
  id: string
  agentId: string
  userId: string
  rail: "stripe" | "circle" | "x402" | "square" | "braintree" | "razorpay"
  authType: "oauth" | "api_key" | "wallet"
  maskedCredential: string
  status: "active" | "revoked" | "error"
  createdAt: string
  updatedAt: string
}

export interface AgentPolicy {
  id: string
  agentId: string
  userId: string
  version: number
  rules: Record<string, unknown>
  createdBy: string
  createdAt: string
}

export interface ConnectorPolicy {
  id: string
  connectorId: string
  userId: string
  version: number
  rules: Record<string, unknown>
  createdBy: string
  createdAt: string
}

export interface AuditLog {
  id: string
  agentId: string
  userId: string
  connectorId: string | null
  rail: string
  action: string
  outcome: "ALLOW" | "DENY" | "HOLD"
  denyRule: string | null
  amount: string | null
  currency: string | null
  recipientId: string | null
  policyId: string | null
  connectorPolicyId: string | null
  argsHash: string | null
  providerTxId: string | null
  approvalId: string | null
  durationMs: number | null
  prevHash: string
  rowHash: string
  createdAt: string
}

export interface Approval {
  id: string
  agentId: string
  userId: string
  auditLogId: string | null
  argsSnapshot: string // JSON string
  amount: string | null
  currency: string | null
  status: "pending" | "approved" | "rejected" | "expired" | "executed" | "execution_failed"
  approvedBy: string | null
  rejectionReason: string | null
  expiresAt: string
  resolvedAt: string | null
  createdAt: string
}

export interface NotificationConfig {
  agentId: string
  emailAddresses: string // JSON string like "[]"
  approvalTimeoutSeconds: number
  updatedAt: string
}

export interface User {
  id: string
  email: string
  role: string
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return post<{ accessToken: string; refreshToken: string; user: User }>("/v1/auth/login", { email, password })
}

export async function register(email: string, password: string) {
  return post<{ accessToken: string; refreshToken: string; user: User }>("/v1/auth/register", { email, password })
}

export async function logoutApi() {
  return post("/v1/auth/logout", {})
}

export async function fetchAgents() {
  return get<Array<Agent>>("/v1/agents")
}

export async function createAgent(body: { name: string; description?: string; webhookUrl?: string }) {
  return post<Agent>("/v1/agents", body)
}

export async function updateAgent(id: string, body: Partial<Pick<Agent, "name" | "description" | "webhookUrl" | "status">>) {
  return patch<Agent>(`/v1/agents/${id}`, body)
}

export async function deleteAgent(id: string) {
  return del(`/v1/agents/${id}`)
}

export async function fetchConnectors() {
  return get<Array<Connector>>("/v1/connectors")
}

export async function createConnector(body: { agentId: string; rail: string; authType: string; credentials: Record<string, string> }) {
  return post<Connector>("/v1/connectors", body)
}

export async function revokeConnector(id: string) {
  return del(`/v1/connectors/${id}`)
}

export async function fetchAgentPolicies(agentId: string) {
  return get<Array<AgentPolicy>>(`/v1/agents/${agentId}/policies`)
}

export async function createAgentPolicy(agentId: string, rules: Record<string, unknown>) {
  return post<AgentPolicy>(`/v1/agents/${agentId}/policies`, { rules })
}

export async function fetchConnectorPolicies(connectorId: string) {
  return get<Array<ConnectorPolicy>>(`/v1/connectors/${connectorId}/policies`)
}

export async function createConnectorPolicy(connectorId: string, rules: Record<string, unknown>) {
  return post<ConnectorPolicy>(`/v1/connectors/${connectorId}/policies`, { rules })
}

export async function fetchAuditLogs(params?: { agentId?: string; outcome?: string; from?: string; to?: string; limit?: number; cursor?: string }) {
  const search = new URLSearchParams()
  if (params?.agentId) search.set("agentId", params.agentId)
  if (params?.outcome) search.set("outcome", params.outcome)
  if (params?.from) search.set("from", params.from)
  if (params?.to) search.set("to", params.to)
  if (params?.limit) search.set("limit", String(params.limit))
  if (params?.cursor) search.set("cursor", params.cursor)
  const qs = search.toString()
  return get<{ items: Array<AuditLog>; nextCursor: string | null }>(`/v1/audit-logs${qs ? `?${qs}` : ""}`)
}

export async function fetchApprovals(params?: { status?: string; agentId?: string }) {
  const search = new URLSearchParams()
  if (params?.status) search.set("status", params.status)
  if (params?.agentId) search.set("agentId", params.agentId)
  const qs = search.toString()
  return get<Array<Approval>>(`/v1/approvals${qs ? `?${qs}` : ""}`)
}

export async function approveApproval(id: string, reason?: string) {
  return post<{ ok: boolean; status: string; providerTxId?: string; error?: string }>(`/v1/approvals/${id}/approve`, { reason })
}

export async function rejectApproval(id: string, reason?: string) {
  return post<{ ok: boolean; status: string }>(`/v1/approvals/${id}/reject`, { reason })
}

export async function fetchNotifications(agentId: string) {
  return get<NotificationConfig>(`/v1/agents/${agentId}/notifications`)
}

export async function updateNotifications(agentId: string, body: { emailAddresses?: Array<string>; approvalTimeoutSeconds?: number; slackWebhookUrl?: string }) {
  return put<NotificationConfig>(`/v1/agents/${agentId}/notifications`, body)
}

export async function fetchApiKeys(agentId: string) {
  return get<Array<ApiKey>>(`/v1/agents/${agentId}/api-keys`)
}

export async function createApiKey(agentId: string, mode: "live" | "test") {
  return post<{ id: string; agentId: string; keyPrefix: string; mode: string; rawKey: string }>(`/v1/agents/${agentId}/api-keys`, { mode })
}

export async function revokeApiKey(agentId: string, keyId: string) {
  return del(`/v1/agents/${agentId}/api-keys/${keyId}`)
}
