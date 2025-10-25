import { z } from "zod";
import { generateWithLLM } from "../index";

/**
 * 仕様書生成ワークフロー
 *
 * 要件テキストから以下を段階的に生成：
 * 1. 要件分析: 入力された要件を構造化
 * 2. システム構成: アーキテクチャと技術スタックを提案
 * 3. 仕様書草稿: 最終的な仕様書ドキュメントを生成
 *
 * Phase 1の最小実装として、LLMを3段階で呼び出すシンプルな関数形式。
 * Phase 2以降でMastra Workflowクラスを使用した対話型フローに拡張。
 */

// 入力スキーマ
export const GenerateSpecInput = z.object({
  requirements: z.string().describe("ユーザーから入力された要件テキスト"),
  projectName: z.string().optional().describe("プロジェクト名（オプション）"),
});

// 出力スキーマ（specs/001-phase1-4-api-spec/data-model.md に準拠）
export const GenerateSpecOutput = z.object({
  analysis: z.object({
    summary: z.string().describe("要件の概要"),
    keyPoints: z.array(z.string()).describe("重要なポイント"),
    actors: z
      .array(z.string())
      .describe("システムに関わるアクター（ユーザー、管理者など）"),
    mainFeatures: z.array(z.string()).describe("主要機能リスト"),
  }),
  architecture: z.object({
    overview: z.string().describe("アーキテクチャの全体像"),
    components: z
      .array(
        z.object({
          name: z.string().describe("コンポーネント名"),
          description: z.string().describe("コンポーネントの説明"),
          responsibilities: z
            .array(z.string())
            .describe("コンポーネントの責務"),
        }),
      )
      .describe("システムコンポーネント"),
    dataFlow: z.string().describe("データフローの説明"),
    technologies: z.array(z.string()).describe("使用技術リスト"),
  }),
  specificationDraft: z
    .string()
    .describe("生成された仕様書草稿（Markdown形式）"),
});

export type GenerateSpecInputType = z.infer<typeof GenerateSpecInput>;
export type GenerateSpecOutputType = z.infer<typeof GenerateSpecOutput>;

/**
 * 仕様書生成を実行する関数
 *
 * @param input - 要件テキストとプロジェクト名
 * @returns 要件分析、アーキテクチャ提案、仕様書草稿
 */
export async function executeGenerateSpec(
  input: GenerateSpecInputType,
): Promise<GenerateSpecOutputType> {
  const { requirements, projectName } = input;

  // Step 1: 要件分析
  console.log("[generateSpec] Step 1: 要件分析を開始");
  const analysisPrompt = `
あなたは経験豊富なエンジニアリングマネージャーです。
以下の要件テキストを分析し、主要な情報を抽出してください。

要件:
${requirements}

以下の形式でJSON出力してください（他のテキストは含めず、JSONのみ）：
{
  "summary": "要件全体の概要（1-2文）",
  "keyPoints": ["重要なポイント1", "重要なポイント2", "重要なポイント3"],
  "actors": ["エンドユーザー", "管理者", "システム"],
  "mainFeatures": ["機能1", "機能2", "機能3"]
}
`;

  const analysisResponse = await generateWithLLM(analysisPrompt, {
    maxTokens: 1000,
    temperature: 0.3, // 分析は一貫性を重視
  });

  let analysis;
  try {
    // JSONブロックから抽出（```json ... ``` などに対応）
    const jsonMatch = analysisResponse.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : analysisResponse;
    analysis = JSON.parse(jsonStr);
  } catch (error) {
    console.warn("[generateSpec] JSON解析失敗、フォールバック使用", error);
    analysis = {
      summary: requirements,
      keyPoints: ["要件の詳細化が必要"],
      actors: ["ユーザー"],
      mainFeatures: ["要件の詳細化が必要"],
    };
  }

  // Step 2: システム構成生成
  console.log("[generateSpec] Step 2: システム構成生成を開始");
  const architecturePrompt = `
あなたは経験豊富なシステムアーキテクトです。
以下の要件分析結果に基づいて、最適なシステムアーキテクチャを提案してください。

要件概要: ${analysis.summary}
重要ポイント: ${analysis.keyPoints.join(", ")}
アクター: ${analysis.actors.join(", ")}
主要機能: ${analysis.mainFeatures.join(", ")}

プロジェクト標準技術スタック:
- バックエンド: Cloudflare Workers + Hono
- エージェント: Mastra
- 言語: TypeScript

以下の形式でJSON出力してください（他のテキストは含めず、JSONのみ）：
{
  "overview": "アーキテクチャの全体像（2-3文）",
  "components": [
    {
      "name": "コンポーネント名",
      "description": "コンポーネントの説明",
      "responsibilities": ["責務1", "責務2"]
    }
  ],
  "dataFlow": "データフローの説明（リクエストから応答まで）",
  "technologies": ["Cloudflare Workers", "Hono", "TypeScript", "Mastra"]
}
`;

  const architectureResponse = await generateWithLLM(architecturePrompt, {
    maxTokens: 2000,
    temperature: 0.5,
  });

  let architecture;
  try {
    const jsonMatch = architectureResponse.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : architectureResponse;
    architecture = JSON.parse(jsonStr);
  } catch (error) {
    console.warn("[generateSpec] JSON解析失敗、フォールバック使用", error);
    architecture = {
      overview: "Cloudflare Workersをベースとしたサーバーレスアーキテクチャ",
      components: [
        {
          name: "API Layer",
          description: "Honoフレームワークによるルーティングとリクエスト処理",
          responsibilities: [
            "リクエストバリデーション",
            "レスポンス生成",
            "エラーハンドリング",
          ],
        },
      ],
      dataFlow:
        "クライアント → Cloudflare Workers → D1データベース → レスポンス",
      technologies: ["Cloudflare Workers", "Hono", "TypeScript", "Mastra"],
    };
  }

  // Step 3: 仕様書草稿生成
  console.log("[generateSpec] Step 3: 仕様書草稿生成を開始");
  const specDraftPrompt = `
あなたは経験豊富なテクニカルライターです。
以下の情報から、詳細な仕様書をMarkdown形式で作成してください。

プロジェクト名: ${projectName || "未定"}

## 要件分析結果
- 概要: ${analysis.summary}
- 重要ポイント: ${analysis.keyPoints.join(", ")}
- アクター: ${analysis.actors.join(", ")}
- 主要機能: ${analysis.mainFeatures.join(", ")}

## システムアーキテクチャ
- 全体像: ${architecture.overview}
- コンポーネント: ${architecture.components.map((c: { name: string }) => c.name).join(", ")}
- データフロー: ${architecture.dataFlow}
- 使用技術: ${architecture.technologies.join(", ")}

以下のセクションを含むMarkdown形式の仕様書を作成してください：
1. プロジェクト概要
2. システムに関わるアクター
3. 主要機能
4. システムアーキテクチャ
5. コンポーネント詳細
6. データフロー
7. 技術スタック

すべて日本語で記述してください。
Markdown形式で出力してください（コードブロックで囲まずに直接出力）。
`;

  const specificationDraft = await generateWithLLM(specDraftPrompt, {
    maxTokens: 3000,
    temperature: 0.7, // 生成は創造性を重視
  });

  console.log("[generateSpec] 仕様書生成完了");

  return {
    analysis,
    architecture,
    specificationDraft,
  };
}
