/**
 * リクエスト型定義
 *
 * POST /api/spec エンドポイントのリクエストボディ型を定義します。
 */

/**
 * POST /api/spec リクエストボディ
 *
 * エンジニアリングマネージャーが送信する要件データです。
 * requirementsは必須、projectNameは任意項目です。
 */
export type SpecRequest = {
  /** 要件テキスト（必須、最小1文字、最大100KB） */
  requirements: string
  /** プロジェクト名（任意） */
  projectName?: string
}
