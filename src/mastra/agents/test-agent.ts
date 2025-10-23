import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core";

export const testAgent = new Agent({
  name: "test-agent",
  instructions: "You are a helpful assistant.",
  model: google("gemini-2.5-flash"),
});
