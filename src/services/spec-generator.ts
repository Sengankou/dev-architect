import { executeGenerateSpec } from "../mastra/workflows/generateSpec";
import type { SpecResponse } from "../types/response";

/**
 * 仕様書生成サービス
 *
 * MastraのgenerateSpecワークフローを呼び出し、要件から仕様書を生成します。
 * タイムアウトはミドルウェアレベル（timeoutMiddleware）で管理されます。
 */
export class SpecGeneratorService {
  /**
   * 要件から仕様書を生成
   *
   * Mastraワークフローを呼び出し、AI分析・アーキテクチャ提案・仕様書草稿を生成します。
   * タイムアウトはルート層のtimeoutMiddlewareで制御されます。
   *
   * @param requirements - 要件テキスト
   * @param projectName - プロジェクト名（任意）
   * @returns 仕様書レスポンス
   * @throws Error - ワークフロー実行エラー
   */
  async generate(
    requirements: string,
    projectName?: string,
  ): Promise<SpecResponse> {
    // Mastraワークフローを実行
    const result = await executeGenerateSpec({ requirements, projectName });

    // レスポンス形式に変換
    return {
      analysis: result.analysis,
      architecture: result.architecture,
      specificationDraft: result.specificationDraft,
    };
  }
}
