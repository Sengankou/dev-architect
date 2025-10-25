/**
 * エンティティ型定義
 *
 * D1データベースのspecsテーブルとアプリケーション層の型を定義します。
 */

/**
 * specsテーブルの行データ（D1から取得される生データ）
 */
export type SpecRow = {
  id: number;
  requirements: string;
  project_name: string | null;
  analysis_json: string; // JSON文字列
  architecture_json: string; // JSON文字列
  spec_draft: string; // Markdown文字列
  created_at: number; // Unixタイムスタンプ（ミリ秒）
};

/**
 * AI分析結果の構造
 *
 * specs/001-phase1-4-api-spec/data-model.md の正式仕様に準拠
 */
export type Analysis = {
  summary: string;
  keyPoints: string[];
  actors: string[];
  mainFeatures: string[];
};

/**
 * アーキテクチャ提案の構造
 *
 * specs/001-phase1-4-api-spec/data-model.md の正式仕様に準拠
 */
export type Architecture = {
  overview: string;
  components: Array<{
    name: string;
    description: string;
    responsibilities: string[];
  }>;
  dataFlow: string;
  technologies: string[];
};

/**
 * アプリケーションレベルのSpec型（JSON解析済み）
 *
 * D1のSpecRowからJSON文字列をパースした後の型です。
 */
export type Spec = {
  id: number;
  requirements: string;
  projectName: string | null;
  analysis: Analysis;
  architecture: Architecture;
  specDraft: string;
  createdAt: Date;
};

/**
 * Phase 2: 対話フロー + セッション管理
 */

/**
 * セッション（会話の単位）
 */
export type Session = {
  id: string; // UUIDv4
  createdAt: number; // Unix epoch秒
  updatedAt: number; // Unix epoch秒
  status: "active" | "archived" | "deleted"; // Phase 2では'active'のみ使用
};

/**
 * メッセージ（セッション内の個別発言）
 */
export type Message = {
  id: string; // UUIDv4
  sessionId: string; // 所属セッションID
  role: "user" | "assistant"; // 発言者
  content: string; // メッセージ内容（最大100KB）
  createdAt: number; // Unix epoch秒
};

/**
 * チャット履歴スナップショット（KVストレージ用）
 */
export type ChatHistory = {
  sessionId: string; // セッションID
  messages: Message[]; // メッセージ配列（最大50件）
  lastUpdatedAt: number; // 最終更新日時（Unix epoch秒）
};
