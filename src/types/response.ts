import type { Analysis, Architecture } from './entities'

/**
 * レスポンス型定義
 *
 * POST /api/spec エンドポイントのレスポンス型を定義します。
 */

/**
 * POST /api/spec 成功レスポンス
 *
 * AIが生成した分析結果、アーキテクチャ提案、仕様書草稿を含みます。
 */
export type SpecResponse = {
  /** AI分析結果 */
  analysis: Analysis
  /** アーキテクチャ提案 */
  architecture: Architecture
  /** 仕様書草稿（Markdown形式） */
  specificationDraft: string
}

/**
 * エラーレスポンス
 *
 * エラー発生時に返されるレスポンスの型です。
 */
export type ErrorResponse = {
  error: {
    /** エラーメッセージ */
    message: string
    /** エラーコード */
    code: 'INVALID_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'LLM_PARSE_ERROR' | 'TIMEOUT' | 'INTERNAL_ERROR'
  }
}
