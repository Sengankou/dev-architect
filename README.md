# Dev Architect

要件をもとにシステムアーキテクチャ、UIなどの仕様書を書いてくれるエージェント

## 概要

AIスタートアップのエンジニアリングマネージャー向けに、要件整理と仕様書作成を対話的に支援するエージェント。
チャットベースで要件をヒアリングし、システムアーキテクチャや仕様書を自動生成します。

## 主要機能

### Phase 1: 仕様書生成 (完了)
- **POST /api/spec**: 要件から仕様書草稿を自動生成
- Mastra + Gemini 2.5 Flash による AI生成
- D1への仕様書永続化

### Phase 2: 対話フロー + セッション管理 (完了)
- **POST /api/chat**: マルチターン会話による要件精緻化
- **GET /api/chat/:sessionId/history**: 会話履歴の取得
- **Web UI**: ブラウザから利用可能な簡易チャットUI
- KV/D1ハイブリッド永続化（50メッセージウィンドウ）
- セッションの自動復元
- XSS対策、レスポンシブデザイン対応

## 技術スタック

- **エージェントフレームワーク**: Mastra
- **デプロイメント**: Cloudflare Workers
- **Webフレームワーク**: Hono
- **リンター・フォーマッター**: Biome
- **言語**: TypeScript

## ファイル構成

```
dev-architect/
├── .specify/                    # Speckit設定・テンプレート
│   ├── memory/
│   │   └── constitution.md      # プロジェクト憲法（開発原則）
│   └── templates/               # 仕様書・タスク生成テンプレート
├── src/
│   ├── index.ts                 # Honoアプリケーションエントリーポイント
│   ├── routes/
│   │   ├── spec.ts              # 仕様書生成API
│   │   └── chat.ts              # チャットAPI (Phase 2)
│   ├── repositories/            # D1データアクセス層
│   │   ├── session-repository.ts
│   │   └── message-repository.ts
│   ├── services/                # ビジネスロジック
│   │   └── chat-history.ts      # KV履歴管理
│   ├── middleware/              # ミドルウェア
│   │   └── message-validator.ts
│   └── mastra/                  # Mastraエージェント
│       └── agents/
│           └── requirement-refiner.ts
├── migrations/                  # D1マイグレーション
│   ├── 0001_create_specs.sql
│   └── 0002_create_sessions_messages.sql
├── public/                      # 静的ファイル（Cloudflare Assets）
│   └── index.html               # チャットUI (Phase 2)
├── tests/                       # テストスイート
│   ├── unit/                    # 単体テスト
│   ├── integration/             # 統合テスト
│   ├── contract/                # APIコントラクトテスト
│   └── manual/                  # 手動テストチェックリスト
├── specs/                       # 仕様書・設計ドキュメント
│   ├── 001-spec-generation/     # Phase 1仕様
│   └── 002-chat-session/        # Phase 2仕様
├── wrangler.jsonc               # Cloudflare Workers設定
├── tsconfig.json                # TypeScript設定
├── package.json                 # 依存関係・スクリプト
├── PROGRESS.md                  # 開発進捗管理
└── worker-configuration.d.ts    # 自動生成された型定義
```

## Cloudflareリソース

### KV Namespace
- **Binding**: `DEV_ARCHITECT_SESSIONS`
- **用途**: 
  - チャットセッション管理（Phase 2）
  - 会話履歴の高速キャッシュ（50メッセージウィンドウ）
  - KV primary → D1 fallback戦略

### D1 Database
- **Binding**: `dev_architect_db`
- **用途**: 
  - 仕様書の永続化（Phase 1）
  - チャットセッション/メッセージの長期保存（Phase 2）
  - KV障害時のフォールバック
- **テーブル**: `specs`, `sessions`, `messages`

### R2 Bucket
- **Binding**: `dev_architect_uploads`
- **用途**: ファイルアップロード、生成された仕様書ドキュメントの保存

## 開発

### セットアップ

```bash
pnpm install

# 環境変数設定
cp .dev.vars.example .dev.vars
# .dev.varsにGOOGLE_GENERATIVE_AI_API_KEYを設定

# .envファイル作成（Mastra用）
cat .dev.vars > .env

# D1マイグレーション適用
pnpm wrangler d1 migrations apply dev_architect_db --local
```

### 開発サーバー起動

```bash
pnpm run dev
# → http://localhost:8787 でチャットUIにアクセス
```

### クイックスタート

1. **チャットUIから使用**:
   - ブラウザで http://localhost:8787 にアクセス
   - メッセージ入力欄に要件を入力（例: 「ECサイトのカート機能を実装したいです」）
   - AIとの対話的な要件精緻化が開始

2. **API経由で使用**:
   ```bash
   # 新規チャットセッション作成
   curl -X POST http://localhost:8787/api/chat \
     -H "Content-Type: application/json" \
     -d '{"message": "ECサイトのカート機能を実装したいです"}'
   
   # 既存セッション継続
   curl -X POST http://localhost:8787/api/chat \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "<sessionId>", "message": "在庫管理も必要です"}'
   
   # 会話履歴取得
   curl http://localhost:8787/api/chat/<sessionId>/history
   ```

### 型生成

Cloudflare Workersの設定に基づいて型を生成:

```bash
npm run cf-typegen
```

### Bindingsの使用

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()

// KVの使用例
await c.env.DEV_ARCHITECT_SESSIONS.get("session_id")

// D1の使用例
await c.env.dev_architect_db.prepare("SELECT * FROM projects").all()

// R2の使用例
await c.env.dev_architect_uploads.put("file_key", fileContent)
```

## デプロイ

```bash
npm run deploy
```

## プロジェクト憲法

開発原則と標準については `.specify/memory/constitution.md` を参照してください。

主要原則:
- 日本語ドキュメンテーション（NON-NEGOTIABLE）
- テスト駆動開発（NON-NEGOTIABLE）
- 対話型要件整理
- Cloudflareアーキテクチャの活用
- 進捗管理と可視化（NON-NEGOTIABLE）

## 開発進捗管理

開発計画と現在の進捗状況は `PROGRESS.md` を参照してください。

- **開発者**: 作業開始前にPROGRESS.mdで現在のフェーズとタスクを確認
- **Claude Code**: すべての作業でPROGRESS.mdを参照・更新（憲法で義務化）
- **更新タイミング**: タスク完了時、フェーズ移行時、計画変更時
