# Implementation Plan: 対話フロー + セッション管理

**Branch**: `002-chat-session` | **Date**: 2025-10-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-chat-session/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Phase 2では、ユーザーとAIのマルチターン会話を実現し、要件を対話的に精緻化する機能を実装する。Phase 1の単発要件入力から、会話形式の要件整理へと進化させることで、不明瞭な点をその場で解消し、高品質な仕様書を生成する。

**主要機能**:
- `/api/chat`エンドポイント（POST）でマルチターン会話
- セッションID単位でKVに会話履歴を保存（高速アクセス）
- D1に会話履歴を永続化（sessions/messagesテーブル）
- Mastraワークフローを会話対応に拡張
- 簡易チャットUI（Cloudflare Pages静的HTML）

**技術アプローチ**:
- KVストレージを会話履歴の一次ストレージとして使用（<200msレスポンス目標）
- D1をベストエフォート型バックアップとして使用（Phase 1パターン継続）
- 50メッセージを超えた場合、最新50件のみLLMコンテキストに含める
- 楽観的並行制御（タイムスタンプ順序保証）でセッション内競合を管理

## Technical Context

**Language/Version**: TypeScript（Constitution要件、型安全性確保）  
**Primary Dependencies**: Hono（Webフレームワーク）, Mastra（エージェント）, Cloudflare Workers SDK, Gemini 2.5 Flash（LLM）  
**Storage**: KVストレージ（DEV_ARCHITECT_SESSIONS、会話履歴一次保存）, D1データベース（dev_architect_db、永続化）  
**Testing**: Vitest + @cloudflare/vitest-pool-workers（Phase 1で設定済み、ただしMastra/OpenTelemetry制約により現在非機能）  
**Target Platform**: Cloudflare Workers（エッジコンピューティング）  
**Project Type**: Web（backend API + frontend static HTML）  
**Performance Goals**: 初回メッセージ応答5秒以内、対話応答5秒以内、会話履歴取得200ms以内、UI応答6秒以内（API 5秒 + 描画1秒）  
**Constraints**: メッセージサイズ100KB、LLMコンテキスト最大50メッセージ、セッション最大100メッセージ、Cloudflare Workers実行時間制約（CPU 30秒）  
**Scale/Scope**: 同時10セッション並行処理、日次10件の仕様書生成（Phase 1と同等、小規模チーム想定）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. 日本語ドキュメンテーション (Japanese Documentation)
✅ **PASS** - spec.md、plan.md、今後のdata-model.md、quickstart.mdすべて日本語で作成

### II. テスト駆動開発 (Test-Driven Development)
✅ **PASS** - tasks.mdでテストファースト実装を計画（Phase 2で実施）

### III. 対話型要件整理 (Interactive Requirements Gathering)
✅ **PASS** - Phase 2の中核機能そのもの（マルチターン会話、要件精緻化）

### IV. 技術スタック標準 (Technology Stack Standards)
✅ **PASS** - Mastra（エージェント）、Cloudflare Workers（デプロイ）、Hono（Web）すべて準拠

### V. 仕様書品質保証 (Specification Quality Assurance)
✅ **PASS** - spec.md完成、/speckit.clarifyで4つの曖昧性を解消、21の機能要件と9の成功基準で品質保証

### VI. Cloudflareアーキテクチャ (Cloudflare Architecture)
✅ **PASS** - KV（高速アクセス）、D1（永続化）、Workers実行時間制約（30秒）を考慮した設計

### VII. 進捗管理と可視化 (Progress Tracking and Visibility)
✅ **PASS** - PROGRESS.mdでPhase 2-1〜2-3を定義、今後tasks.mdで詳細タスク管理

### VIII. コミット管理 (Commit Management)
✅ **PASS** - Conventional Commits準拠（feat/fix/docs等）、小さい粒度のコミットを計画

### パフォーマンス目標
✅ **PASS** - 初回3秒、対話5秒、仕様書生成10分の憲法目標をspec.mdで定義（SC-001〜SC-003）

### スケール目標
✅ **PASS** - 同時10人、日次10件の憲法目標をspec.mdで定義（SC-005）

### 会話履歴保持
✅ **PASS** - FR-015で最新50件をLLMコンテキストに含め、全履歴はD1で永続化（憲法要件「全会話履歴カバー」に準拠）

**結論**: すべてのConstitution原則に準拠。Phase 0研究に進む準備完了。

---

## Constitution Check（Phase 1設計後の再評価）

*GATE: Phase 1設計完了後、実装前の最終確認*

### Phase 1成果物

- ✅ **research.md**: KV/D1/Mastra/UI/Rate Limiting技術調査完了（5トピック）
- ✅ **data-model.md**: Session/Message/ChatHistory型定義、D1スキーマ設計、TypeScript型定義
- ✅ **contracts/chat-api.yaml**: OpenAPI 3.1.0仕様（POST /api/chat、GET /api/chat/:sessionId/history）
- ✅ **quickstart.md**: ローカル開発から本番デプロイまでの手順書（10ステップ）

### Constitution再評価

#### I. 日本語ドキュメンテーション
✅ **PASS（強化）** - research.md、data-model.md、contracts/chat-api.yaml、quickstart.mdすべて日本語で作成済み

#### II. テスト駆動開発
✅ **PASS（強化）** - quickstart.mdでTDDパターン明記（SessionRepository/MessageRepositoryテストファースト実装例）

#### III. 対話型要件整理
✅ **PASS（強化）** - requirement-refiner Agent設計完了（instructions、質問例、回答形式をquickstart.mdに記載）

#### IV. 技術スタック標準
✅ **PASS（強化）** - research.mdでMastra Agent Memory、Cloudflare KV/D1/Rate Limiting API採用確定

#### V. 仕様書品質保証
✅ **PASS（強化）** - contracts/chat-api.yamlで21の機能要件をAPIコントラクトとして形式化、エラーレスポンス詳細定義

#### VI. Cloudflareアーキテクチャ
✅ **PASS（強化）** - research.mdでKV 5ms読み込みレイテンシ、D1複合インデックス最適化、Rate Limiting API統合設計完了

#### VII. 進捗管理と可視化
✅ **PASS（維持）** - 次ステップで`/speckit.tasks`実行時にtasks.mdで詳細タスク管理

#### VIII. コミット管理
✅ **PASS（維持）** - 小さい粒度のコミット（research.md、data-model.md、contracts/、quickstart.md個別提案予定）

**最終結論**: Phase 1設計完了。すべてのConstitution原則に準拠。Phase 2実装（`/speckit.tasks`）に進む準備完了。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── routes/
│   ├── spec.ts           # 既存（Phase 1）: POST /api/spec
│   └── chat.ts           # 新規（Phase 2）: POST /api/chat, GET /api/chat/:sessionId/history
├── repositories/
│   ├── spec-repository.ts      # 既存（Phase 1）
│   ├── session-repository.ts   # 新規（Phase 2）: sessionsテーブルCRUD
│   └── message-repository.ts   # 新規（Phase 2）: messagesテーブルCRUD
├── services/
│   └── chat-history.ts   # 新規（Phase 2）: KV読み書き、50件ウィンドウ管理
├── mastra/
│   ├── workflows/
│   │   ├── generateSpec.ts   # 既存（Phase 1）
│   │   └── chatConversation.ts  # 新規（Phase 2）: マルチターン会話ワークフロー
│   └── agents/
│       └── requirement-refiner.ts  # 新規（Phase 2）: 要件精緻化エージェント
├── types/
│   └── entities.ts       # 既存（Phase 1、Phase 2で拡張）: Session, Message型追加
├── middleware/
│   ├── error-handler.ts  # 既存（Phase 1）
│   ├── payload-size-check.ts  # 既存（Phase 1、Phase 2で再利用）
│   └── timeout.ts        # 既存（Phase 1、Phase 2で再利用）
└── index.ts              # 既存（Phase 1、Phase 2で/api/chatルート追加）

public/
└── index.html            # 既存（Phase 1）、Phase 2で簡易チャットUIに拡張

migrations/
├── 0001_create_specs.sql     # 既存（Phase 1）
└── 0002_create_sessions_messages.sql  # 新規（Phase 2）

tests/
├── unit/
│   ├── repositories/
│   │   ├── spec-repository.test.ts       # 既存（Phase 1）
│   │   ├── session-repository.test.ts    # 新規（Phase 2）
│   │   └── message-repository.test.ts    # 新規（Phase 2）
│   └── services/
│       └── chat-history.test.ts          # 新規（Phase 2）
├── integration/
│   └── chat-flow.test.ts                 # 新規（Phase 2）: エンドツーエンドテスト
└── contract/
    └── chat-api.test.ts                  # 新規（Phase 2）: APIコントラクトテスト
```

**Structure Decision**: 
- **Web application構造**: backend（src/）+ frontend（public/）を採用
- **Phase 1からの継続性**: 既存のroutes/repositories/mastraディレクトリを拡張
- **新規コンポーネント**: chat.ts（ルート）、session/message repositories、chat-history service、chatConversation workflow
- **UI統合**: public/index.htmlを簡易チャットUIに拡張（Cloudflare Pages静的ホスティング）

## Complexity Tracking

該当なし - すべてのConstitution原則に準拠し、違反なし。
