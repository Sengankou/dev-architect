# Dev Architect

要件をもとにシステムアーキテクチャ、UIなどの仕様書を書いてくれるエージェント

## 概要

AIスタートアップのエンジニアリングマネージャー向けに、要件整理と仕様書作成を対話的に支援するエージェント。
チャットベースで要件をヒアリングし、システムアーキテクチャや仕様書を自動生成します。

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
│       ├── spec-template.md
│       ├── plan-template.md
│       └── tasks-template.md
├── src/
│   └── index.ts                 # Honoアプリケーションエントリーポイント
├── public/                      # 静的ファイル（Cloudflare Assets）
│   └── index.html
├── wrangler.jsonc               # Cloudflare Workers設定
├── biome.json                   # Biome設定（リンター・フォーマッター）
├── tsconfig.json                # TypeScript設定
├── package.json                 # 依存関係・スクリプト
└── worker-configuration.d.ts    # 自動生成された型定義（wrangler types）
```

## Cloudflareリソース

### KV Namespace
- **Binding**: `DEV_ARCHITECT_SESSIONS`
- **用途**: セッション管理、会話履歴の一時保存

### D1 Database
- **Binding**: `dev_architect_db`
- **用途**: 構造化データの永続化（仕様書、プロジェクト情報等）

### R2 Bucket
- **Binding**: `dev_architect_uploads`
- **用途**: ファイルアップロード、生成された仕様書ドキュメントの保存

## 開発

### セットアップ

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
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
