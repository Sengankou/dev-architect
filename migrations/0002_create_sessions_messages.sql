-- Phase 2: 対話フロー + セッション管理
-- migrations/0002_create_sessions_messages.sql

-- sessionsテーブル
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- UUIDv4形式のセッションID
  created_at INTEGER NOT NULL,       -- Unix epoch秒
  updated_at INTEGER NOT NULL,       -- Unix epoch秒
  status TEXT NOT NULL DEFAULT 'active' -- active/archived/deleted
);

-- messagesテーブル
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- UUIDv4形式のメッセージID
  session_id TEXT NOT NULL,         -- 外部キー（sessionsテーブル）
  role TEXT NOT NULL,               -- "user" or "assistant"
  content TEXT NOT NULL,            -- メッセージ内容（最大100KB）
  created_at INTEGER NOT NULL,      -- Unix epoch秒
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
