import type { ExecuteResponse, AllowResponse, DenyResponse, HoldResponse } from "./types.ts";

export function isAllow(r: ExecuteResponse): r is AllowResponse {
	return r.outcome === "ALLOW";
}

export function isDeny(r: ExecuteResponse): r is DenyResponse {
	return r.outcome === "DENY";
}

export function isHold(r: ExecuteResponse): r is HoldResponse {
	return r.outcome === "HOLD";
}
