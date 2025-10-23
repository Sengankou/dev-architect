import { Mastra } from "@mastra/core/mastra";
import { testAgent } from "./agents/test-agent";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Mastraアプリケーション初期化
 *
 * Dev Architectエージェントの中核となるMastraインスタンス。
 * - LLMプロバイダー: Google Gemini 2.5 Flash
 * - ワークフロー: workflows/ディレクトリで定義
 * - エージェント: agents/ディレクトリで定義（Phase 2以降）
 */

// Google Gemini プロバイダーの初期化
// API キーは環境変数 GOOGLE_GENERATIVE_AI_API_KEY から取得
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

// Gemini 2.5 Flash モデル
const geminiModel = google("gemini-2.5-flash");

// Mastraアプリケーションインスタンス
export const mastra = new Mastra({
  // Phase 2以降でエージェント、ワークフロー、ツールを追加
  agents: { testAgent },
});

/**
 * LLM生成関数をエクスポート（ワークフローで使用）
 * Gemini 2.5 Flashモデルを使用してテキストを生成
 */
export async function generateWithLLM(
  prompt: string,
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const { generateText } = await import("ai");

  const result = await generateText({
    model: geminiModel,
    prompt: prompt,
    temperature: options?.temperature || 0.7,
  });

  return result.text;
}
