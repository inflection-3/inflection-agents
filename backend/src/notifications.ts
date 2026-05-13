import { eq } from "drizzle-orm";
import { db } from "./db/connector";
import { notificationConfigs } from "./db/schema";
import { decryptCredentials } from "./connectors/encryption";

export interface HoldNotificationPayload {
  approvalId: string;
  agentId: string;
  action: string;
  amount?: string;
  currency?: string;
  reason?: string;
}

async function sendSlackNotification(
  webhookUrl: string,
  payload: HoldNotificationPayload
): Promise<void> {
  const amountStr =
    payload.amount && payload.currency
      ? ` for ${payload.amount} ${payload.currency.toUpperCase()}`
      : "";

  const text = [
    `*[Inflection] Approval Required*`,
    `Action \`${payload.action}\`${amountStr} is held pending review.`,
    `Approval ID: \`${payload.approvalId}\``,
    `Reason: ${payload.reason ?? "Policy threshold exceeded"}`,
  ].join("\n");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}

async function sendEmailNotification(
  addresses: string[],
  payload: HoldNotificationPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || addresses.length === 0) return;

  const amountStr =
    payload.amount && payload.currency
      ? ` for ${payload.amount} ${payload.currency.toUpperCase()}`
      : "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "noreply@inflection.ai",
      to: addresses,
      subject: `[Inflection] Approval Required: ${payload.action}`,
      html: `<h2>Approval Required</h2>
<p>Action <code>${payload.action}</code>${amountStr} is held pending review.</p>
<p><strong>Approval ID:</strong> <code>${payload.approvalId}</code></p>
<p><strong>Reason:</strong> ${payload.reason ?? "Policy threshold exceeded"}</p>
<p>Log in to the Inflection dashboard to approve or reject this request.</p>`,
    }),
  });

  if (!res.ok) throw new Error(`Resend API returned ${res.status}`);
}

export async function dispatchHoldNotification(
  payload: HoldNotificationPayload
): Promise<void> {
  const config = await db
    .select()
    .from(notificationConfigs)
    .where(eq(notificationConfigs.agentId, payload.agentId))
    .get();

  if (!config) return;

  const tasks: Promise<void>[] = [];

  if (config.slackWebhookUrlEnc && config.slackWebhookIv) {
    tasks.push(
      decryptCredentials<{ url: string }>(
        config.slackWebhookUrlEnc as Buffer,
        config.slackWebhookIv
      )
        .then(({ url }) => sendSlackNotification(url, payload))
        .catch((err) => {
          console.error("[notifications] Slack error:", (err as Error).message);
        })
    );
  }

  const emailAddresses: string[] = JSON.parse(config.emailAddresses ?? "[]");
  if (emailAddresses.length > 0) {
    tasks.push(
      sendEmailNotification(emailAddresses, payload).catch((err) => {
        console.error("[notifications] Email error:", (err as Error).message);
      })
    );
  }

  await Promise.allSettled(tasks);
}
