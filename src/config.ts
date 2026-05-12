import { createOpenAI } from "@ai-sdk/openai";
import "dotenv/config";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

export const model = openrouter("anthropic/claude-opus-4");

export function logStep(stepType: string, toolName?: string, input?: unknown, output?: unknown) {
  if (toolName) {
    console.log(`\n[tool:${toolName}]`);
    if (input) console.log("  input:", JSON.stringify(input, null, 2));
    if (output) console.log("  output:", JSON.stringify(output, null, 2));
  } else {
    console.log(`\n[${stepType}]`);
  }
}
