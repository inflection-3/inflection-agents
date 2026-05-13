import { lt, eq, and } from "drizzle-orm";
import { db } from "../db/connector";
import { approvals } from "../db/schema";

export async function sweepExpiredApprovals(): Promise<void> {
  await db
    .update(approvals)
    .set({ status: "expired", resolvedAt: new Date() })
    .where(
      and(
        eq(approvals.status, "pending"),
        lt(approvals.expiresAt, new Date())
      )
    );
}

export function startExpirySweeper(): ReturnType<typeof setInterval> {
  return setInterval(async () => {
    try {
      await sweepExpiredApprovals();
    } catch (err) {
      console.error("[expiry-sweeper] error:", (err as Error).message);
    }
  }, 60_000);
}
