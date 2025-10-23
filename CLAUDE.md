# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Dev Architectは、AIスタートアップのエンジニアリングマネージャー向けの要件定義支援エージェントです。対話的に要件をヒアリングし、システムアーキテクチャやUIを含む仕様書を自動生成します。

技術スタック: Cloudflare Workers + Hono + Mastra + TypeScript

## 必須開発原則（Constitution）

プロジェクト憲法（`.specify/memory/constitution.md`）で定義された以下の原則を必ず遵守すること：

### 1. 日本語ドキュメンテーション（NON-NEGOTIABLE）
- すべてのドキュメント、仕様書、設計書、コード内コメントは日本語で記述
- ユーザーは日本のエンジニアリングマネージャー想定

### 2. テスト駆動開発（NON-NEGOTIABLE）
- 必ずテストファースト（Red → Green → Refactor）
- 実装前にテストが存在しない場合、実装を開始してはならない

### 3. 対話型要件整理
- チャットベースで要件をヒアリング
- 不明瞭な点は必ず質問して確認
- 将来的には音声入力対応

### 4. 技術スタック標準
- エージェント: Mastra（必須）
- デプロイ: Cloudflare Workers（必須）
- フレームワーク: Hono（必須）

### 5. 進捗管理と可視化（NON-NEGOTIABLE）
- **PROGRESS.md参照**: 作業開始時、タスク切り替え時、完了時に必ずPROGRESS.mdを参照し、現在地を把握すること
- **PROGRESS.md更新**: タスク完了時、フェーズ移行時、計画変更時に即座にPROGRESS.mdを更新すること
- **現在地の明示**: ユーザーとのやり取りで、常に「Phase X-Y」など現在の位置を明示すること
- **単一の真実の源**: PROGRESS.mdをプロジェクト全体の進捗状況の唯一の信頼できる情報源として扱うこと

### 6. 最新ドキュメント参照（NON-NEGOTIABLE）
- **新規タスク開始時**: 必ず最新の公式ドキュメントをWeb検索・参照してから実装を開始すること
- **フレームワーク/ライブラリ使用時**: 公式ドキュメント、GitHub、ベストプラクティスを確認すること
- **推測禁止**: ドキュメントで確認せずに古い知識や推測で実装してはならない
- **検索ツール**: WebSearch、WebFetchツールを積極的に活用すること

## 開発コマンド

```bash
# 開発サーバー起動（http://localhost:8787）
pnpm run dev

# 型生成（Cloudflare Bindings）
pnpm run cf-typegen

# デプロイ（本番環境）
pnpm run deploy
```

## アーキテクチャ

### Cloudflare Workersの特性
- エッジコンピューティング環境
- Cold Start、実行時間、メモリ制約を考慮した設計が必要
- パフォーマンス目標: 初回3秒、対話5秒、仕様書生成10分以内
- スケール目標: 同時10人、日次10件（小規模チーム向け）

### ルーティング設計
- `/` - 静的HTML（`public/index.html`、Assetsバインディング経由）
- `/message` - ホームページ用メッセージエンドポイント
- `/api/*` - APIエンドポイント（Honoルーティング）

**重要**: Assetsバインディングは静的ファイルを優先的に返すため、APIルートは必ず`/api`プレフィックスを使用すること。

### Cloudflare Bindings

プロジェクトは3つのCloudflareリソースを使用：

```typescript
// 型は worker-configuration.d.ts でグローバルに定義済み
interface Env {
  DEV_ARCHITECT_SESSIONS: KVNamespace;    // セッション管理、会話履歴
  dev_architect_db: D1Database;            // 構造化データ（仕様書、プロジェクト情報）
  dev_architect_uploads: R2Bucket;         // ファイルアップロード、ドキュメント保存
  ASSETS: Fetcher;                         // 静的ファイル配信
}

// Honoでの使用例
const app = new Hono<{ Bindings: Env }>();
app.get('/api/example', async (c) => {
  await c.env.DEV_ARCHITECT_SESSIONS.put('key', 'value');
  const result = await c.env.dev_architect_db.prepare('SELECT * FROM table').all();
  await c.env.dev_architect_uploads.put('file.txt', 'content');
});
```

### ローカル vs リモートストレージ

開発時（`pnpm run dev`）はローカルストレージ（`.wrangler/state/`）を使用。

```bash
# ローカルKVにデータ保存（開発用）
pnpm wrangler kv key put --binding=DEV_ARCHITECT_SESSIONS "key" "value"

# リモートKVにデータ保存（本番用）
pnpm wrangler kv key put --binding=DEV_ARCHITECT_SESSIONS "key" "value" --remote
```

### 型システム

- `worker-configuration.d.ts`は`pnpm run cf-typegen`で自動生成
- `Env`型はグローバルに宣言されているため、インポート不要
- この自動生成ファイルは編集しない

## Speckit統合

`.specify/`ディレクトリにSpeckit（仕様書生成ツール）の設定が格納されています：

- `memory/constitution.md` - プロジェクト憲法（開発原則）
- `templates/` - 仕様書、実装計画、タスク生成用テンプレート

Speckitコマンドは別途定義されており、要件から仕様書を生成する際に使用します。

## 会話履歴の管理

Constitution要件: エージェントは全会話履歴を常にカバーする必要がある（コンテキストエンジニアリング前提）。会話の最初から最新までの全体的な流れを把握できるよう設計すること。
