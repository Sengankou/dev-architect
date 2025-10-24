import { executeGenerateSpec } from '../mastra/workflows/generateSpec'
import type { SpecResponse } from '../types/response'

/**
 * 仕様書生成サービス
 *
 * MastraのgenerateSpecワークフローを呼び出し、要件から仕様書を生成します。
 * 60秒タイムアウトを適用し、レスポンスを整形して返します。
 */
export class SpecGeneratorService {
  /**
   * 要件から仕様書を生成
   *
   * Mastraワークフローを呼び出し、AI分析・アーキテクチャ提案・仕様書草稿を生成します。
   * 60秒のタイムアウトを設定し、タイムアウト時はエラーをスローします。
   *
   * @param requirements - 要件テキスト
   * @param projectName - プロジェクト名（任意）
   * @returns 仕様書レスポンス
   * @throws Error - タイムアウトまたはワークフロー実行エラー
   */
  async generate(
    requirements: string,
    projectName?: string
  ): Promise<SpecResponse> {
    // 60秒タイムアウトを設定
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = new Error('Request timeout')
        error.name = 'TimeoutError'
        reject(error)
      }, 60000)
    })

    try {
      // Mastraワークフローとタイムアウトを競合させる
      const result = await Promise.race([
        executeGenerateSpec({ requirements, projectName }),
        timeoutPromise,
      ])

      // レスポンス形式に変換
      return {
        analysis: result.analysis,
        architecture: result.architecture,
        specificationDraft: result.specificationDraft,
      }
    } catch (error) {
      // タイムアウトまたはワークフローエラーをそのまま上位に伝播
      throw error
    }
  }
}
