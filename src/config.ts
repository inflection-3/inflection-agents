import { anthropic } from "@ai-sdk/anthropic";
import "dotenv/config";

export const model = anthropic("claude-opus-4-7");

export function logStep(stepType: string, toolName?: string, input?: unknown, output?: unknown) {
  if (toolName) {
    console.log(`\n[tool:${toolName}]`);
    if (input) console.log("  input:", JSON.stringify(input, null, 2));
    if (output) console.log("  output:", JSON.stringify(output, null, 2));
  } else {
    console.log(`\n[${stepType}]`);
  }
}
