-- 仕様書テーブルの作成
-- Phase 1-4: /api/specエンドポイントで生成された仕様書を保存
CREATE TABLE IF NOT EXISTS specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirements TEXT NOT NULL,
  project_name TEXT,
  analysis_json TEXT NOT NULL,
  architecture_json TEXT NOT NULL,
  spec_draft TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- インデックス: 作成日時での検索用（最新の仕様書を高速取得）
CREATE INDEX idx_specs_created_at ON specs(created_at DESC);
