# Tasks: /api/specエンドポイント実装

**Input**: Design documents from `/specs/001-phase1-4-api-spec/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-spec.openapi.yaml

**Tests**: Phase 1-4では単体テストを含む。TDD原則に従い、テストを先に作成してから実装する。

**Organization**: User Story単位でタスクを分割し、各Storyを独立して実装・テスト可能にする。

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: どのUser Storyに属するか（US1, US2, US3）
- ファイルパスを必ず含める

---

## Phase 1: Setup（共通基盤）

**目的**: プロジェクト初期化と基盤構造の構築

- [ ] T001 Vitestと@cloudflare/vitest-pool-workersをインストール（pnpm add -D vitest @cloudflare/vitest-pool-workers）
- [ ] T002 vitest.config.tsを作成（research.mdのVitest設定を適用、readD1Migrations()でmigrations/ディレクトリを指定、miniflare設定でd1_databases: ['dev_architect_db']を含める）
- [ ] T003 [P] test/setup.tsを作成（D1マイグレーション自動適用）
- [ ] T004 [P] migrations/0001_create_specs_table.sqlを作成（data-model.mdのスキーマ適用）
- [ ] T005 D1マイグレーションをローカル環境に適用（wrangler d1 migrations apply dev_architect_db --local）
- [ ] T006 [P] src/types/entities.tsを作成（SpecRow, Analysis, Architecture, Spec型定義）
- [ ] T007 [P] src/types/request.tsを作成（SpecRequest型定義）
- [ ] T008 [P] src/types/response.tsを作成（SpecResponse, ErrorResponse型定義）

**Checkpoint**: 基盤準備完了 - User Story実装が開始可能

---

## Phase 2: Foundational（ブロッキング前提条件）

**目的**: 全User Storyが依存するコア基盤（この完了前にUser Story実装は不可）

**⚠️ CRITICAL**: Phase 2完了まで、どのUser Story作業も開始できない

- [ ] T009 src/middleware/error-handler.tsを作成（app.onError()でHTTPException/ZodError/TimeoutErrorを捕捉し、ErrorResponse型のJSON（{error: {message, code}}）を返す。research.mdの実装例を参照）
- [ ] T010 [P] src/middleware/payload-size-check.tsを作成（bodyLimit 100KB制限、research.md参照）
- [ ] T011 [P] src/middleware/timeout.tsを作成（60秒タイムアウト、research.md参照）
- [ ] T012 [P] src/utils/logger.tsを作成（Console APIラッパー、エラーログ用）
- [ ] T013 [P] src/utils/validation.tsを作成（zodスキーマ定義とバリデーションヘルパー）
- [ ] T014 src/repositories/spec-repository.tsを作成（SpecRepositoryクラス、data-model.md参照）

**Checkpoint**: 基盤完成 - User Story実装が並列実行可能

---

## Phase 3: User Story 1 - 仕様書草稿の生成 (Priority: P1) 🎯 MVP

**Goal**: エンジニアリングマネージャーが要件をPOSTすると、AIが分析・アーキテクチャ・仕様書草稿を生成して返す

**Independent Test**: curl/HTTPクライアントで`POST /api/spec`にJSON要件を送信し、analysis/architecture/specificationDraftを含むレスポンスが返ることを確認

### Tests for User Story 1

> **NOTE: これらのテストを先に作成し、REDであることを確認してから実装を開始**

- [ ] T015 [P] [US1] tests/unit/services/spec-generator.test.tsを作成（SpecGeneratorServiceの単体テスト、Mastraワークフローモック）
- [ ] T016 [P] [US1] tests/unit/repositories/spec-repository.test.tsを作成（SpecRepositoryのCRUD単体テスト、D1モック）
- [ ] T017 [P] [US1] tests/unit/routes/spec.test.tsを作成（POST /api/specエンドポイント単体テスト、service/repositoryモック）
- [ ] T018 [US1] tests/integration/api-spec.test.tsを作成（エンドツーエンド統合テスト、実際のD1使用）

### Implementation for User Story 1

- [ ] T019 [P] [US1] src/services/spec-generator.tsを作成（SpecGeneratorService、Mastraワークフロー呼び出し、60秒タイムアウト適用、日本語コメントで機能説明を含む）
- [ ] T020 [US1] src/routes/spec.tsを作成（POST /api/specエンドポイント、zValidator適用、ミドルウェア統合、日本語コメントで処理フローを説明）
- [ ] T021 [US1] src/index.tsを更新（app.route('/api/spec', spec)登録、app.onError()登録）
- [ ] T022 [US1] テスト実行（pnpm test）し、すべてのUser Story 1テストがGREENであることを確認
- [ ] T023 [US1] ローカル開発サーバーで動作確認（pnpm run dev、quickstart.mdのテストケース1実施）

**Checkpoint**: User Story 1が完全に機能し、独立してテスト可能

---

## Phase 4: User Story 2 - エラーハンドリング (Priority: P2)

**Goal**: 不正リクエスト/タイムアウト発生時に、明確なエラーメッセージとエラーコードを返す

**Independent Test**: 不正リクエスト（空要件、不正JSON、100KB超）を送信し、適切なHTTPステータスコードとエラーレスポンスが返ることを確認

### Tests for User Story 2

> **NOTE: これらのテストを先に作成し、REDであることを確認してから実装を開始**

- [ ] T024 [P] [US2] tests/unit/routes/spec-error-handling.test.tsを作成（バリデーションエラー400、ペイロード過大413、タイムアウト504のテスト）
- [ ] T025 [P] [US2] tests/integration/api-spec-error.test.tsを作成（エラーケースのエンドツーエンドテスト）

### Implementation for User Story 2

- [ ] T026 [P] [US2] src/routes/spec.tsを更新（zodバリデーションエラーハンドリング強化、空文字列チェック、日本語コメントでエラー処理を説明）
- [ ] T027 [US2] src/middleware/error-handler.tsを更新（ZodError/HTTPException/TimeoutError処理、contracts/api-spec.openapi.yaml準拠、日本語コメントでエラー分岐を説明）
- [ ] T028 [US2] src/middleware/payload-size-check.tsを更新（413エラーカスタムレスポンス、ErrorResponse型準拠、日本語コメントでペイロード制限理由を説明）
- [ ] T029 [US2] テスト実行（pnpm test）し、User Story 2テストがGREENであることを確認
- [ ] T030 [US2] ローカル開発サーバーでエラーケース確認（quickstart.mdのテストケース3, 4実施）

**Checkpoint**: User Story 1とUser Story 2が両方独立して機能

---

## Phase 5: User Story 3 - D1永続化 (Priority: P2)

**Goal**: 生成された仕様書データをD1データベースに確実に保存し、履歴参照を可能にする

**Independent Test**: APIリクエスト成功後、D1の`specs`テーブルをクエリして、要件・分析結果・アーキテクチャ・仕様書草稿が保存されていることを確認

### Tests for User Story 3

> **NOTE: これらのテストを先に作成し、REDであることを確認してから実装を開始**

- [ ] T031 [P] [US3] tests/unit/repositories/spec-repository-save.test.tsを作成（create()メソッドの単体テスト、JSON serialize検証）
- [ ] T032 [P] [US3] tests/integration/api-spec-persistence.test.tsを作成（D1保存のエンドツーエンドテスト、wrangler d1 executeで検証）

### Implementation for User Story 3

- [ ] T033 [US3] src/repositories/spec-repository.tsを更新（create()メソッド実装、JSON.stringify()適用、エラーハンドリング、日本語コメントでD1操作を説明）
- [ ] T034 [US3] src/routes/spec.tsを更新（SpecRepository統合、D1保存失敗時はログのみ記録、日本語コメントでベストエフォート型永続化を説明）
- [ ] T035 [US3] src/services/spec-generator.tsを更新（projectName含むレスポンス型調整、D1連携準備、日本語コメントで型調整理由を説明）
- [ ] T036 [US3] テスト実行（pnpm test）し、User Story 3テストがGREENであることを確認
- [ ] T037 [US3] D1データ確認（wrangler d1 execute dev_architect_db --local --command "SELECT * FROM specs"）

**Checkpoint**: 全User Storyが独立して機能、永続化が完全動作

---

## Phase 6: Polish & Cross-Cutting Concerns

**目的**: 複数User Storyにまたがる改善

- [ ] T038 [P] package.jsonにtestスクリプト追加（"test": "vitest run", "test:watch": "vitest"）
- [ ] T039 [P] .gitignoreを更新（.wrangler/, .dev.vars, test-results/追加）
- [ ] T040 コードクリーンアップ（未使用import削除、型安全性確認、npx tsc --noEmit実行）
- [ ] T041 [P] src/utils/logger.tsを更新（構造化ログ、timestamp付与）
- [ ] T042 quickstart.md検証（全テストケース実施、READMEとの整合性確認）
- [ ] T043 [P] 日本語コメント最終確認（全ファイルの日本語コメント品質チェック、Constitution I準拠確認）
- [ ] T044 PROGRESS.mdを更新（Phase 1-4を100%完了にマーク、次フェーズへの準備状態記載）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即座に開始可能
- **Foundational (Phase 2)**: Setup完了後 - 全User Storyをブロック
- **User Stories (Phase 3-5)**: 全てFoundational完了に依存
  - 並列実行可能（チーム構成次第）
  - または優先順位順に順次実行（P1 → P2 → P2）
- **Polish (Phase 6)**: 全User Story完了後

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完了後に開始可能 - 他Storyに依存なし
- **User Story 2 (P2)**: Foundational完了後に開始可能 - US1と統合されるが独立テスト可能
- **User Story 3 (P2)**: Foundational完了後に開始可能 - US1/US2と統合されるが独立テスト可能

### Within Each User Story

- テスト → 実装（TDD原則）
- テストが先にFAILすることを確認
- Services → Repositories
- Routes → Middleware統合
- Story完了確認 → 次のPriority移行

### Parallel Opportunities

- Setup内の[P]タスクは並列実行可能
- Foundational内の[P]タスクは並列実行可能
- Foundational完了後、全User Storyを並列開始可能（チーム構成次第）
- 各User Story内の[P]テストタスクは並列実行可能
- 各User Story内の[P]実装タスクは並列実行可能
- 異なるUser Storyは異なるチームメンバーが並列作業可能

---

## Parallel Example: User Story 1

```bash
# User Story 1のテストを一斉起動（TDDステップ）
Task: "tests/unit/services/spec-generator.test.tsを作成"
Task: "tests/unit/repositories/spec-repository.test.tsを作成"
Task: "tests/unit/routes/spec.test.tsを作成"

# User Story 1の実装を並列起動（テストGREEN確認後）
Task: "src/services/spec-generator.tsを作成"
```

---

## Implementation Strategy

### MVP First (User Story 1のみ)

1. Phase 1: Setup完了
2. Phase 2: Foundational完了（CRITICAL - 全Storyブロック）
3. Phase 3: User Story 1完了
4. **STOP and VALIDATE**: User Story 1を独立テスト
5. デプロイ/デモ準備完了

### Incremental Delivery

1. Setup + Foundational完了 → 基盤準備OK
2. User Story 1追加 → 独立テスト → デプロイ/デモ（MVP！）
3. User Story 2追加 → 独立テスト → デプロイ/デモ
4. User Story 3追加 → 独立テスト → デプロイ/デモ
5. 各Storyが前Storyを破壊せずに価値追加

### Parallel Team Strategy

複数開発者の場合:

1. チームでSetup + Foundationalを共同完了
2. Foundational完了後:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Storyが独立完了・統合

---

## Notes

- **[P]** = 異なるファイル、依存なし
- **[Story]** = 特定User Storyへのトレーサビリティ
- 各User Storyは独立完了・テスト可能
- テストがFAILすることを確認してから実装開始（TDD）
- タスクごと、または論理的グループごとにコミット
- 任意のCheckpointでStoryを独立検証可能
- 避けるべき: 曖昧なタスク、同一ファイル競合、Story独立性を破壊する依存関係
