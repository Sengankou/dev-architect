# Implementation Plan: /api/specエンドポイント実装

**Branch**: `001-phase1-4-api-spec` | **Date**: 2025-10-24 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-phase1-4-api-spec/spec.md`

## Summary

Phase 1-4では、エンジニアリングマネージャーが要件をJSON形式で送信すると、MastraのgenerateSpecワークフローを呼び出してAI分析・アーキテクチャ・仕様書草稿を生成し、D1データベースに永続化する`POST /api/spec`エンドポイントを実装する。Honoフレームワークを使用し、Cloudflare Workers上で動作する。エラーハンドリング、タイムアウト処理、ペイロードサイズ制限を含む。

## Technical Context

**Language/Version**: TypeScript（Node.js互換、Cloudflare Workers環境）  
**Primary Dependencies**: 
- Hono 4.10.1（Webフレームワーク）
- Mastra 0.17.3（AIエージェントフレームワーク）
- @mastra/core 0.22.2（Mastraコア機能）
- @ai-sdk/google 2.0.23（Gemini LLM統合）
- zod 4.1.12（バリデーション）

**Storage**: 
- D1データベース（`specs`テーブル）
- バインディング名: `dev_architect_db`（wrangler.jsoncに設定済み）
- データベースID: `87dac84e-d9a7-4f1f-8a93-a34f581534c3`

**Testing**: 
- 単体テスト: Vitest（Phase 1-4で導入）
- 統合テスト: wrangler dev + curl（Phase 1-6で実施）

**Target Platform**: Cloudflare Workers（エッジコンピューティング環境）  
**Project Type**: Web（バックエンドAPI、Hono + Cloudflare Workers）  
**Performance Goals**: 
- エンドポイント応答時間: 60秒以内（LLM処理含む）
- 同時リクエスト処理: 5件並列
- ペイロードサイズ上限: 100KB

**Constraints**: 
- Cloudflare Workers実行時間制限を考慮（CPU時間: 30秒、実行時間: 制限なし）
- メモリ制約: 128MB（Workersデフォルト）
- Cold Start対応: 初回応答3秒以内が目標

**Scale/Scope**: 
- 想定同時ユーザー: 10人
- 1日あたりの仕様書生成: 10件程度
- D1データベーステーブル: 1テーブル（`specs`）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. 日本語ドキュメンテーション
- すべてのドキュメント（spec.md, plan.md, tasks.md）は日本語で記述済み
- コード内コメントは実装時に日本語で記述する

### ✅ II. テスト駆動開発
- Phase 1-4では単体テストを先に作成してから実装
- テストフレームワーク（Vitest）をPhase 0で調査・導入
- テストファースト原則を遵守

### ✅ III. 対話型要件整理
- 本フェーズはAPI実装のみだが、将来的にPhase 2で対話フローを実装予定
- `/api/spec`は仕様書生成の基盤として設計

### ✅ IV. 技術スタック標準
- Mastra: ✅ 使用（generateSpecワークフロー呼び出し）
- Cloudflare Workers: ✅ デプロイ先
- Hono: ✅ Webフレームワーク

### ⚠️ V. 仕様書品質保証
- エッジケース処理とエラーハンドリングを適切に実装すること
- D1保存失敗時の可用性優先設計に注意

### ✅ VI. Cloudflareアーキテクチャ
- Cloudflare Workersの特性を考慮した設計
- D1バインディングは既にwrangler.jsoncに設定済み
- エッジ環境での並列実行を考慮

### ✅ VII. 進捗管理と可視化
- PROGRESS.mdのPhase 1-4を参照して実装
- 完了時にPROGRESS.mdを更新

### ✅ VIII. コミット管理
- 実装時に変更ごとにConventional Commitsに準拠したコミットメッセージを提示

**判定**: すべての原則に準拠。Phase 0リサーチへ進行可能。

## Project Structure

### Documentation (this feature)

```text
specs/001-phase1-4-api-spec/
├── spec.md                    # 仕様書（完了）
├── plan.md                    # 実装計画（本ファイル）
├── research.md                # Phase 0 リサーチ結果（生成予定）
├── data-model.md              # Phase 1 データモデル（生成予定）
├── quickstart.md              # Phase 1 クイックスタート（生成予定）
├── contracts/                 # Phase 1 API契約（生成予定）
│   └── api-spec.openapi.yaml  # OpenAPI仕様
└── tasks.md                   # Phase 2 タスク分解（/speckit.tasksで生成）
```

### Source Code (repository root)

```text
# Web application (backend API)
src/
├── index.ts                         # Honoエントリーポイント（既存）
├── mastra/                          # Mastraアプリケーション（既存）
│   ├── index.ts                     # Mastraインスタンス
│   ├── agents/                      # エージェント定義
│   │   └── test-agent.ts            # テスト用エージェント
│   └── workflows/                   # ワークフロー定義
│       └── generateSpec.ts          # 仕様書生成ワークフロー（Phase 1-3完了）
├── routes/                          # APIルート（新規作成）
│   └── spec.ts                      # /api/spec エンドポイント（Phase 1-4で実装）
├── middleware/                      # ミドルウェア（新規作成）
│   ├── error-handler.ts             # エラーハンドリング
│   ├── payload-size-check.ts        # ペイロードサイズチェック
│   └── timeout.ts                   # タイムアウト処理
├── services/                        # ビジネスロジック（新規作成）
│   └── spec-generator.ts            # 仕様書生成サービス
├── repositories/                    # データアクセス（新規作成）
│   └── spec-repository.ts           # specsテーブルアクセス
├── types/                           # 型定義（新規作成）
│   ├── request.ts                   # リクエスト型
│   ├── response.ts                  # レスポンス型
│   └── entities.ts                  # エンティティ型
└── utils/                           # ユーティリティ（新規作成）
    ├── logger.ts                    # ロギング
    └── validation.ts                # バリデーション

tests/                               # テストディレクトリ（新規作成）
├── unit/                            # 単体テスト
│   ├── routes/
│   │   └── spec.test.ts
│   ├── services/
│   │   └── spec-generator.test.ts
│   └── repositories/
│       └── spec-repository.test.ts
└── integration/                     # 統合テスト（Phase 1-6）
    └── api-spec.test.ts

migrations/                          # D1マイグレーション（新規作成）
└── 0001_create_specs_table.sql      # specsテーブル作成スクリプト

public/                              # 静的ファイル（既存）
└── index.html

worker-configuration.d.ts            # Cloudflare Bindings型定義（自動生成）
wrangler.jsonc                       # Cloudflare Workers設定（D1/KV/R2設定済み）
package.json                         # 依存関係（Phase 1-4で更新）
```

**Structure Decision**: Web application構造を採用。Phase 1-4では`/api/spec`エンドポイントのみを実装し、将来的にPhase 2で`/api/chat`等を追加する拡張性を考慮した設計とする。レイヤードアーキテクチャ（routes → services → repositories）を採用し、テスト可能性とメンテナンス性を確保する。

## Complexity Tracking

**現時点では違反なし**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| - | - | - |

## Phase 0: Outline & Research

### 調査が必要な技術領域

1. **Honoでのペイロードサイズ制限の実装方法**
   - Honoミドルウェアでのリクエストボディサイズチェック
   - 100KBを超えるリクエストの検出と413エラー返却
   - ベストプラクティス: Content-Lengthヘッダーチェック vs ストリーミングチェック

2. **Cloudflare WorkersでのD1データベース操作**
   - D1マイグレーションスクリプトの作成・実行方法（wrangler.jsonc環境）
   - D1でのトランザクション処理の可否と制約
   - エラーハンドリングのベストプラクティス
   - ローカル開発時の動作（`.wrangler/state/`）

3. **Cloudflare Workersでのタイムアウト処理**
   - 60秒タイムアウトの実装方法（AbortController、Promise.race等）
   - Cloudflare Workers環境での制約と注意点
   - LLM APIコール時のタイムアウト処理

4. **Vitest + Cloudflare Workers環境のセットアップ**
   - Cloudflare Workers環境でのVitest設定（vitest.config.ts）
   - D1データベースのモック方法（@cloudflare/vitest-pool-workers）
   - Mastraワークフローのモック方法
   - 非同期処理のテスト方法

5. **Honoのエラーハンドリングベストプラクティス**
   - グローバルエラーミドルウェアの実装パターン
   - HTTPステータスコードの適切な使用（400, 413, 500, 504）
   - JSON形式のエラーレスポンス統一
   - zod バリデーションエラーの変換

### リサーチエージェント起動

次のステップで各技術領域について並列リサーチを実行し、`research.md`にまとめます。

## Phase 1: Design & Contracts

*Phase 0完了後に実施*

### 成果物

- **data-model.md**: `specs`テーブルのD1スキーマ定義（カラム、型、制約）
- **contracts/api-spec.openapi.yaml**: OpenAPI 3.0仕様（リクエスト/レスポンススキーマ、エラーコード）
- **quickstart.md**: 開発環境セットアップとエンドポイント動作確認手順

### データモデル設計方針

- `specs`テーブル設計（spec.mdより）:
  - `id`: INTEGER PRIMARY KEY AUTOINCREMENT
  - `requirements`: TEXT NOT NULL（要件テキスト）
  - `project_name`: TEXT（プロジェクト名、任意）
  - `analysis_json`: TEXT NOT NULL（AI分析結果JSON）
  - `architecture_json`: TEXT NOT NULL（アーキテクチャ提案JSON）
  - `spec_draft`: TEXT NOT NULL（仕様書草稿Markdown）
  - `created_at`: INTEGER NOT NULL（Unixタイムスタンプ）

### API契約設計方針

- エンドポイント: `POST /api/spec`
- リクエスト: JSON `{"requirements": "string", "projectName": "string?"}`
- 成功レスポンス（200）: `{"analysis": {}, "architecture": {}, "specificationDraft": "string"}`
- エラーレスポンス: `{"error": {"message": "string", "code": "string"}}`
- エラーコード:
  - `INVALID_REQUEST` (400)
  - `PAYLOAD_TOO_LARGE` (413)
  - `LLM_PARSE_ERROR` (500)
  - `TIMEOUT` (504)

## Phase 2: Task Decomposition

*Phase 1完了後に`/speckit.tasks`コマンドで生成*

- `tasks.md`: 実装タスクの詳細な分解と依存関係、テストファースト順序
