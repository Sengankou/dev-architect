import { Mastra } from "@mastra/core";

/**
 * Mastra設定ファイル
 *
 * Dev Architectエージェントの基本設定を定義
 * - LLMモデル設定（OpenAI）
 * - ワークフロー登録
 */

export const mastra = new Mastra({
  // LLMプロバイダーの設定
  // OpenAI APIキーは環境変数 OPENAI_API_KEY から取得
  llm: {
    provider: "OPEN_AI",
    name: "gpt-4o-mini", // 高速・低コストのモデルを使用
    apiKey: process.env.OPENAI_API_KEY || "",
  },

  // ログレベル（開発時は詳細ログ、本番は最小限）
  logLevel: process.env.NODE_ENV === "production" ? "ERROR" : "DEBUG",
});
