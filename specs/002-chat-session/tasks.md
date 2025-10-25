# Tasks: 対話フロー + セッション管理

**Feature**: Phase 2 - 対話フロー + セッション管理  
**Branch**: `002-chat-session`  
**Input**: Design documents from `/specs/002-chat-session/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chat-api.yaml, quickstart.md

**Tests**: Constitution原則IIに従い、すべての実装前にテストを作成します（TDD: Red → Green → Refactor）

**Organization**: User Storyごとにタスクを整理し、各ストーリーを独立して実装・テスト可能にします。

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: タスクが所属するUser Story（US1, US2, US3, US4）
- ファイルパスを正確に記述

## Path Conventions

プロジェクトは **Web application構造**（backend: src/ + frontend: public/）を採用：
- Backend: `src/`（routes/, repositories/, services/, mastra/, types/, middleware/）
- Frontend: `public/`（静的HTML）
- Tests: `tests/`（unit/, integration/, contract/）
- Migrations: `migrations/`（D1スキーマ）

---

## Phase 1: Setup（共通インフラ）

**目的**: Phase 2実装に必要なD1マイグレーションとKV設定

- [ ] T001 D1マイグレーション作成: `migrations/0002_create_sessions_messages.sql`
- [ ] T002 D1マイグレーション適用: ローカル環境（`pnpm wrangler d1 migrations apply dev_architect_db --local`）
- [ ] T003 [P] KVネームスペース作成: `DEV_ARCHITECT_SESSIONS`バインディング設定（wrangler.toml更新）
- [ ] T004 [P] Rate Limitingバインディング追加: `CHAT_RATE_LIMIT`設定（wrangler.toml更新）
- [ ] T005 型定義拡張: `src/types/entities.ts`にSession/Message/ChatHistory型追加

---

## Phase 2: Foundational（ブロッキング前提条件）

**目的**: すべてのUser Story実装前に完了必須のコア基盤

**⚠️ CRITICAL**: このフェーズ完了まで、User Storyの実装を開始できません

- [ ] T006 SessionRepository実装: `src/repositories/session-repository.ts`（create, findById, updateUpdatedAt）
- [ ] T007 MessageRepository実装: `src/repositories/message-repository.ts`（create, findBySessionId）
- [ ] T008 ChatHistoryService実装: `src/services/chat-history.ts`（KV読み書き、50件ウィンドウ管理）
- [ ] T009 [P] メッセージバリデーション関数実装: `src/middleware/message-validator.ts`（100KB制限、制御文字チェック）
- [ ] T010 [P] Mastra requirement-refiner Agent作成: `src/mastra/agents/requirement-refiner.ts`

**Checkpoint**: 基盤完成 - User Story実装開始可能

---

## Phase 3: User Story 1 - 要件の対話的入力 (Priority: P1) 🎯 MVP

**Goal**: ユーザーとAIのマルチターン会話を実現し、要件を段階的に詳細化できる

**Independent Test**: 
```bash
# 新規セッション作成
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ECサイトのカート機能を実装したいです"}'
# → sessionIdとAI応答が返される

# 既存セッション継続
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "<上記のsessionId>", "message": "はい、在庫管理も必要です"}'
# → 会話履歴を踏まえたAI応答が返される
```

### Tests for User Story 1（TDD: Red → Green → Refactor）

> **Constitution原則II**: これらのテストを先に書き、FAILすることを確認してから実装開始

- [ ] T011 [P] [US1] SessionRepositoryユニットテスト作成: `tests/unit/repositories/session-repository.test.ts`
- [ ] T012 [P] [US1] MessageRepositoryユニットテスト作成: `tests/unit/repositories/message-repository.test.ts`
- [ ] T013 [P] [US1] ChatHistoryServiceユニットテスト作成: `tests/unit/services/chat-history.test.ts`
- [ ] T014 [US1] POST /api/chatコントラクトテスト作成: `tests/contract/chat-api.test.ts`（新規セッション、既存セッション、バリデーションエラー）
- [ ] T015 [US1] 対話フローインテグレーションテスト作成: `tests/integration/chat-flow.test.ts`（エンドツーエンド）

### Implementation for User Story 1

- [ ] T016 [US1] POST /api/chatルート実装: `src/routes/chat.ts`（新規セッション生成、メッセージバリデーション、KV読み込み、Mastra Agent実行、KV/D1保存、ベストエフォート型永続化）
- [ ] T017 [US1] index.tsにchatルート追加: `src/index.ts`（`app.route('/api/chat', chat)`）
- [ ] T018 [US1] ロギング追加: セッション作成、メッセージ送受信、エラー発生時のログ（FR-021、構造化ログ）
- [ ] T019 [US1] テスト実行: T011〜T015が全てPASSすることを確認（`pnpm test`）
- [ ] T020 [US1] 手動統合テスト: `pnpm run dev`起動後、curlで上記Independent Testを実行

**Checkpoint**: User Story 1が完全に機能し、独立してテスト可能

---

## Phase 4: User Story 2 - セッションの永続化と復元 (Priority: P2)

**Goal**: 過去の会話セッションを再開して、以前の文脈を保持したまま要件の追加議論ができる

**Independent Test**:
```bash
# 1. セッション作成
SESSION_ID=$(curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "テスト"}' | jq -r '.sessionId')

# 2. ブラウザリロードまたはAPI再接続をシミュレート（数秒待機）
sleep 5

# 3. 同じセッションIDで新しいメッセージ送信
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"続きをお願いします\"}"
# → 過去の会話履歴を踏まえたAI応答が返される
```

### Tests for User Story 2（TDD: Red → Green → Refactor）

- [ ] T021 [US2] セッション復元インテグレーションテスト作成: `tests/integration/session-restore.test.ts`（セッション作成 → 時間経過 → 復元 → 文脈保持確認）
- [ ] T022 [US2] D1永続化ベストエフォート型テスト作成: `tests/integration/d1-best-effort.test.ts`（D1失敗時もKV成功なら200返却、Clarifications Q1）

### Implementation for User Story 2

- [ ] T023 [US2] Session.updatedAt更新ロジック実装: `src/routes/chat.ts`のPOST /api/chat内（メッセージ送信時に既存セッションのupdatedAtを更新）
- [ ] T024 [US2] D1ベストエフォート型エラーハンドリング実装: `src/routes/chat.ts`内（D1保存失敗時もKV成功なら200返却、ログ記録）
- [ ] T025 [US2] テスト実行: T021〜T022が全てPASSすることを確認
- [ ] T026 [US2] 手動統合テスト: 上記Independent Testを実行し、セッション復元が正常動作することを確認

**Checkpoint**: User Stories 1と2が両方とも独立して動作

---

## Phase 5: User Story 3 - 会話履歴の可視化 (Priority: P3)

**Goal**: 過去の会話履歴を時系列で閲覧し、要件の精緻化プロセスを確認できる

**Independent Test**:
```bash
# 1. セッション作成と複数メッセージ送信
SESSION_ID=$(curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "要件1"}' | jq -r '.sessionId')

curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"要件2\"}"

# 2. 会話履歴取得
curl http://localhost:8787/api/chat/$SESSION_ID/history | jq
# → 時系列順（古い順）でメッセージ配列が返される
```

### Tests for User Story 3（TDD: Red → Green → Refactor）

- [ ] T027 [US3] GET /api/chat/:sessionId/historyコントラクトテスト作成: `tests/contract/history-api.test.ts`（複数メッセージ、空履歴、404エラー）
- [ ] T028 [US3] KVフォールバック to D1テスト作成: `tests/integration/history-fallback.test.ts`（KV失敗時にD1から読み込み）

### Implementation for User Story 3

- [ ] T029 [US3] GET /api/chat/:sessionId/historyルート実装: `src/routes/chat.ts`（KVから履歴取得、KV失敗時はD1からフォールバック、時系列順ソート）
- [ ] T030 [US3] テスト実行: T027〜T028が全てPASSすることを確認
- [ ] T031 [US3] 手動統合テスト: 上記Independent Testを実行し、会話履歴取得が正常動作することを確認

**Checkpoint**: User Stories 1, 2, 3が全て独立して動作

---

## Phase 6: User Story 4 - 簡易チャットUI (Priority: P3)

**Goal**: ブラウザからチャットUIを通じて対話的に要件を入力できる

**Independent Test**:
```bash
# 1. ブラウザで http://localhost:8787 にアクセス
# 2. メッセージ入力欄に「ECサイトのカート機能を実装したいです」と入力
# 3. 送信ボタンをクリック
# → AI応答が画面に表示される
# 4. 追加メッセージを送信
# → 会話履歴が保持され、文脈を踏まえたAI応答が表示される
# 5. ページリロード
# → localStorageからセッションIDが復元され、過去の会話履歴が表示される
```

### Tests for User Story 4（TDD: Red → Green → Refactor）

> **Note**: UIのユニットテストはPhase 2では実装しない（手動テストのみ）。Phase 3以降で自動E2Eテスト導入を検討。

- [ ] T032 [US4] UIマニュアルテストチェックリスト作成: `tests/manual/chat-ui-checklist.md`（メッセージ送信、AI応答表示、sessionID保存、履歴復元、ローディング表示、エラー表示）

### Implementation for User Story 4

- [ ] T033 [P] [US4] チャットUI HTML作成: `public/index.html`（メッセージ入力欄、送信ボタン、メッセージ表示エリア、CSS）
- [ ] T034 [US4] チャットUI JavaScript実装: `public/index.html`内のscriptタグ（fetch('/api/chat')、localStorageセッションID管理、textContentでXSS対策、FR-018）
- [ ] T035 [US4] ローディング表示実装: 送信ボタン無効化（FR-019）
- [ ] T036 [US4] エラーハンドリング実装: 404/503エラー時のユーザーフレンドリーなメッセージ表示（FR-020）
- [ ] T037 [US4] ページロード時の会話履歴復元実装: `fetch('/api/chat/${sessionId}/history')`でlocalStorageからセッションID取得、履歴表示
- [ ] T038 [US4] レスポンシブデザイン実装: CSS Flexbox/Gridでスマートフォン対応（SC-009）
- [ ] T039 [US4] 手動UIテスト: 上記Independent TestをブラウザでステップバイステップA実行、T032チェックリスト全項目確認

**Checkpoint**: 全User Stories（1〜4）が独立して動作

---

## Phase 7: Polish & Cross-Cutting Concerns

**目的**: 複数User Storyに影響する改善・品質向上

- [ ] T040 [P] PROGRESS.md更新: Phase 2-1（対話フロー実装）を100%完了にマーク
- [ ] T041 [P] README.md更新: Phase 2機能の説明追加（マルチターン会話、セッション管理、簡易UI）
- [ ] T042 コードクリーンアップ: 未使用インポート削除、コメント整理
- [ ] T043 型チェック実行: `npx tsc --noEmit`でエラーがないことを確認
- [ ] T044 [P] パフォーマンス検証: SC-001〜SC-009の成功基準を満たすか確認（初回5秒、対話5秒、会話履歴200ms、UI応答6秒）
- [ ] T045 [P] セキュリティレビュー: FR-013（メッセージバリデーション）、FR-018（XSS対策）、FR-021（ロギング）の実装確認
- [ ] T046 quickstart.md検証: 10ステップの手順を実際に実行し、手順書が正確か確認
- [ ] T047 D1マイグレーション適用: 本番環境（`pnpm wrangler d1 migrations apply dev_architect_db --remote`）
- [ ] T048 本番デプロイ: `pnpm run deploy`で本番環境にデプロイ

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即座に開始可能
- **Foundational (Phase 2)**: Setup完了後 - すべてのUser Storyをブロック
- **User Stories (Phase 3〜6)**: すべてFoundational完了に依存
  - User Storiesは並列実行可能（チームリソースがあれば）
  - または優先度順に順次実行（P1 → P2 → P3）
- **Polish (Phase 7)**: 全User Story完了後

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完了後開始可能 - 他ストーリーに依存なし
- **User Story 2 (P2)**: Foundational完了後開始可能 - US1と統合するが独立してテスト可能
- **User Story 3 (P3)**: Foundational完了後開始可能 - US1/US2と統合するが独立してテスト可能
- **User Story 4 (P3)**: Foundational完了後開始可能 - US1/US2/US3のAPI利用だが独立してテスト可能

### Within Each User Story

1. **テストファースト**: テスト作成 → FAILを確認 → 実装開始（Constitution原則II）
2. **モデル → サービス → エンドポイント**: Repository → Service → Route の順
3. **コア実装 → 統合**: 各ストーリーのコア機能完成後に他ストーリーと統合
4. **ストーリー完了**: 次の優先度に進む前に現在のストーリーを完全にテスト

### Parallel Opportunities

- **Setup内**: T001, T003, T004は並列実行可能
- **Foundational内**: T009, T010は並列実行可能
- **Foundational完了後**: US1, US2, US3, US4すべて並列開始可能（チームキャパシティ次第）
- **US1テスト**: T011, T012, T013は並列実行可能
- **US3テスト**: T027, T028は並列実行可能
- **US4実装**: T033のHTMLとT032のチェックリストは並列実行可能
- **Polish**: T040, T041, T044, T045は並列実行可能

---

## Parallel Example: User Story 1

```bash
# US1のテストをすべて並列で起動（TDD: Red phase）
Task: "SessionRepositoryユニットテスト作成: tests/unit/repositories/session-repository.test.ts"
Task: "MessageRepositoryユニットテスト作成: tests/unit/repositories/message-repository.test.ts"
Task: "ChatHistoryServiceユニットテスト作成: tests/unit/services/chat-history.test.ts"

# 確認: すべてのテストがFAILすることを確認
pnpm test

# US1の実装を順次実行（TDD: Green phase）
Task: "POST /api/chatルート実装: src/routes/chat.ts"
Task: "index.tsにchatルート追加: src/index.ts"
Task: "ロギング追加"

# 確認: すべてのテストがPASSすることを確認（TDD: Refactor phase）
pnpm test
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. **Phase 1完了**: Setup（D1マイグレーション、KV設定、型定義）
2. **Phase 2完了**: Foundational（Repository、Service、Agent） - すべてのストーリーをブロック
3. **Phase 3完了**: User Story 1（対話的入力）
4. **STOP and VALIDATE**: User Story 1を独立してテスト
5. デプロイ/デモ準備完了（MVP!）

### Incremental Delivery

1. Setup + Foundational完了 → 基盤準備完了
2. User Story 1追加 → 独立してテスト → デプロイ/デモ（MVP!）
3. User Story 2追加 → 独立してテスト → デプロイ/デモ
4. User Story 3追加 → 独立してテスト → デプロイ/デモ
5. User Story 4追加 → 独立してテスト → デプロイ/デモ
6. 各ストーリーが価値を追加し、既存ストーリーを壊さない

### Parallel Team Strategy

複数開発者がいる場合:

1. **チーム全体**: Setup + Foundationalを一緒に完了
2. **Foundational完了後**:
   - Developer A: User Story 1（P1、MVP）
   - Developer B: User Story 2（P2、セッション復元）
   - Developer C: User Story 3（P3、履歴可視化）
   - Developer D: User Story 4（P3、簡易UI）
3. 各ストーリーが独立して完成・統合

---

## Constitution Compliance

### Constitution原則IIテスト駆動開発チェック

各User Storyで以下を確認:

- ✅ テストファースト: 実装前にテスト作成（T011〜T015, T021〜T022, T027〜T028）
- ✅ Red確認: テストがFAILすることを確認
- ✅ Green実装: 最小限の実装でテストをPASS
- ✅ Refactor: コード品質向上

### Constitution原則VIIIコミット管理チェック

各タスク完了時に以下のフォーマットでコミット提案:

```bash
# Setup phase例
git commit -m "feat: create d1 migration for sessions and messages tables"

# Foundational phase例
git commit -m "feat: implement SessionRepository with create/findById/updateUpdatedAt"

# User Story 1例
git commit -m "test: add contract tests for POST /api/chat endpoint"
git commit -m "feat: implement POST /api/chat route with session management"

# Polish phase例
git commit -m "docs: update PROGRESS.md to mark phase 2-1 complete"
```

---

## Notes

- **[P]タスク**: 異なるファイル、依存関係なし、並列実行可能
- **[Story]ラベル**: タスクをUser Storyにマッピング、トレーサビリティ確保
- **各User Storyの独立性**: 独立して完成・テスト可能
- **TDD厳守**: テストFAIL確認後に実装開始（Constitution原則II）
- **コミット粒度**: 各タスクまたは論理的グループごとにコミット（Constitution原則VIII）
- **チェックポイント**: 各フェーズ終了時にストーリーを独立して検証
- **避けるべきこと**: 曖昧なタスク、同一ファイルの競合、ストーリー間依存関係による独立性の破壊

---

## Summary

**Total Tasks**: 48タスク

**Tasks per User Story**:
- Setup: 5タスク（T001〜T005）
- Foundational: 5タスク（T006〜T010）
- User Story 1: 10タスク（T011〜T020）
- User Story 2: 6タスク（T021〜T026）
- User Story 3: 5タスク（T027〜T031）
- User Story 4: 8タスク（T032〜T039）
- Polish: 9タスク（T040〜T048）

**Parallel Opportunities**: 16タスクが並列実行可能（[P]マーク）

**Independent Test Criteria**: 各User Storyに独立したテスト手順を定義

**Suggested MVP Scope**: User Story 1のみ（Phase 1 + Phase 2 + Phase 3）

**Constitution Compliance**: すべてのタスクがConstitution原則II（TDD）とVIII（コミット管理）に準拠
