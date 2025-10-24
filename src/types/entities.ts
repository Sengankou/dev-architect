/**
 * エンティティ型定義
 *
 * D1データベースのspecsテーブルとアプリケーション層の型を定義します。
 */

/**
 * specsテーブルの行データ（D1から取得される生データ）
 */
export type SpecRow = {
  id: number
  requirements: string
  project_name: string | null
  analysis_json: string  // JSON文字列
  architecture_json: string  // JSON文字列
  spec_draft: string  // Markdown文字列
  created_at: number  // Unixタイムスタンプ（ミリ秒）
}

/**
 * AI分析結果の構造
 */
export type Analysis = {
  summary: string
  keyPoints: string[]
  actors: string[]
  mainFeatures: string[]
}

/**
 * アーキテクチャ提案の構造
 */
export type Architecture = {
  overview: string
  components: Array<{
    name: string
    description: string
    responsibilities: string[]
  }>
  dataFlow: string
  technologies: string[]
}

/**
 * アプリケーションレベルのSpec型（JSON解析済み）
 *
 * D1のSpecRowからJSON文字列をパースした後の型です。
 */
export type Spec = {
  id: number
  requirements: string
  projectName: string | null
  analysis: Analysis
  architecture: Architecture
  specDraft: string
  createdAt: Date
}
