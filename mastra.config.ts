import { Mastra } from "@mastra/core";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Mastra設定ファイル
 *
 * Dev Architectエージェントの基本設定を定義
 * - LLMモデル設定（Google Gemini 2.5 Flash）
 * - ワークフロー登録
 */

// Google Gemini プロバイダーの初期化
// API キーは環境変数 GOOGLE_GENERATIVE_AI_API_KEY から取得
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

export const mastra = new Mastra({
  // LLMプロバイダーの設定
  // Gemini 2.5 Flash: 高速・低コストで最新のマルチモーダルモデル
  llm: {
    provider: google,
    name: "gemini-2.5-flash",
  },

  // ログレベル（開発時は詳細ログ、本番は最小限）
  logLevel: process.env.NODE_ENV === "production" ? "ERROR" : "DEBUG",
});
