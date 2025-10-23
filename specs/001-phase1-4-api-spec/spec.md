# Feature Specification: /api/specエンドポイント実装

**Feature Branch**: `001-phase1-4-api-spec`  
**Created**: 2025-10-24  
**Status**: Draft  
**Input**: User description: "phase1-4をPROGRESS.mdを参照して進めていきたい"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 仕様書草稿の生成 (Priority: P1)

エンジニアリングマネージャーが、プロジェクト要件をJSON形式でAPIに送信すると、AIが分析・アーキテクチャ設計・仕様書草稿を生成して返す。

**Why this priority**: 本機能の中核となる価値提供。要件から仕様書を自動生成する最小限の機能であり、Phase 1全体の完了条件を満たすために不可欠。

**Independent Test**: curlまたはHTTPクライアントで`POST /api/spec`にJSON要件を送信し、analysis、architecture、specificationDraftを含むレスポンスが返ることを確認できる。

**Acceptance Scenarios**:

1. **Given** エンジニアリングマネージャーが要件テキストを用意している、**When** `POST /api/spec`に`{"requirements": "ユーザー認証機能を実装したい"}`を送信する、**Then** 200レスポンスとともに`{"analysis": {...}, "architecture": {...}, "specificationDraft": "..."}`が返される
2. **Given** 要件とプロジェクト名の両方を指定する、**When** `POST /api/spec`に`{"requirements": "...", "projectName": "MyApp"}`を送信する、**Then** プロジェクト名を考慮した仕様書草稿が生成される
3. **Given** 生成処理が完了する、**When** レスポンスを受信する、**Then** D1データベースの`specs`テーブルに新しいレコードが1件保存されている

---

### User Story 2 - エラーハンドリング (Priority: P2)

不正なリクエストやタイムアウト発生時に、エンジニアリングマネージャーが問題を特定できるよう、明確なエラーメッセージとエラーコードを返す。

**Why this priority**: ユーザー体験を向上させ、デバッグを容易にするために重要。ただし、正常系が動作することが最優先。

**Independent Test**: 不正なリクエスト（空の要件、不正なJSON等）を送信し、適切なHTTPステータスコードとエラーレスポンスが返ることを確認できる。

**Acceptance Scenarios**:

1. **Given** 要件フィールドが空または欠落している、**When** `POST /api/spec`に`{}`または`{"requirements": ""}`を送信する、**Then** 400 Bad Requestと`{"error": {"message": "requirements is required", "code": "INVALID_REQUEST"}}`が返される
2. **Given** LLM処理が60秒を超える、**When** タイムアウトが発生する、**Then** 504 Gateway Timeoutと`{"error": {"message": "Request timeout", "code": "TIMEOUT"}}`が返される
3. **Given** 不正なJSON形式のリクエストボディ、**When** APIにリクエストを送信する、**Then** 400 Bad Requestと適切なエラーメッセージが返される

---

### User Story 3 - D1永続化 (Priority: P2)

生成された仕様書データが確実にD1データベースに保存され、後続のフェーズで履歴参照や再利用が可能になる。

**Why this priority**: Phase 2以降のセッション管理や仕様書履歴機能の基盤となるため重要。ただし、Phase 1の完了条件としては「レスポンスが返る」ことが最優先。

**Independent Test**: APIリクエスト成功後、D1の`specs`テーブルをクエリして、要件・分析結果・アーキテクチャ・仕様書草稿が保存されていることを確認できる。

**Acceptance Scenarios**:

1. **Given** 仕様書生成が成功する、**When** レスポンスが返される、**Then** D1の`specs`テーブルに`requirements`、`analysis_json`、`architecture_json`、`spec_draft`、`created_at`が保存されている
2. **Given** プロジェクト名が指定されている、**When** 仕様書が生成される、**Then** `project_name`フィールドにその値が保存されている
3. **Given** プロジェクト名が指定されていない、**When** 仕様書が生成される、**Then** `project_name`フィールドがNULLで保存されている

---

### Edge Cases

- リクエストボディが極端に大きい場合（例: 100KB以上）、適切にエラーを返すか？
- LLMが不正なJSON形式を返した場合、システムはどう処理するか？
- D1への書き込みが失敗した場合でも、レスポンスは返されるか、それともエラーになるか？
- 同時に複数のリクエストが来た場合、Mastraワークフローは正常に並列実行されるか？
- requirements内に特殊文字（絵文字、制御文字等）が含まれる場合、正常に処理されるか？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは`POST /api/spec`エンドポイントを提供しなければならない
- **FR-002**: システムは`{"requirements": "string", "projectName": "string?"}`形式のJSONリクエストを受け付けなければならない
- **FR-003**: システムは`requirements`フィールドの必須チェックを行い、欠落または空文字列の場合は400エラーを返さなければならない
- **FR-004**: システムはMastraの`generateSpec`ワークフローを呼び出し、要件を分析しなければならない
- **FR-005**: システムは分析結果（analysis）、アーキテクチャ提案（architecture）、仕様書草稿（specificationDraft）を生成しなければならない
- **FR-006**: システムは成功時に`{"analysis": {}, "architecture": {}, "specificationDraft": "string"}`形式のJSONレスポンスを返さなければならない
- **FR-007**: システムはエラー時に`{"error": {"message": "string", "code": "string"}}`形式のJSONレスポンスを返さなければならない
- **FR-008**: システムは処理時間が60秒を超えた場合、タイムアウトエラーを返さなければならない
- **FR-009**: システムは生成結果をD1データベースの`specs`テーブルに保存しなければならない
- **FR-010**: システムは`specs`テーブルに以下のフィールドを保存しなければならない: `id`, `requirements`, `project_name`, `analysis_json`, `architecture_json`, `spec_draft`, `created_at`
- **FR-011**: システムはHTTPステータスコードを適切に使用しなければならない（成功: 200、バリデーションエラー: 400、タイムアウト: 504、サーバーエラー: 500）
- **FR-012**: システムはD1への保存失敗時でも、ユーザーにレスポンスを返さなければならない（ベストエフォート型）

### Key Entities

- **Spec（仕様書）**: エンジニアリングマネージャーの要件から生成された仕様書データ。要件テキスト、AI分析結果（JSON）、アーキテクチャ提案（JSON）、仕様書草稿（Markdown形式）、作成日時を含む。プロジェクト名は任意項目。
- **SpecRequest（仕様書生成リクエスト）**: APIリクエストとして送信されるデータ。必須項目として要件テキスト、任意項目としてプロジェクト名を含む。
- **SpecResponse（仕様書生成レスポンス）**: APIレスポンスとして返されるデータ。分析結果、アーキテクチャ提案、仕様書草稿を含む。
- **ErrorResponse（エラーレスポンス）**: エラー発生時に返されるデータ。エラーメッセージとエラーコードを含む。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: エンジニアリングマネージャーが要件を送信してから仕様書草稿を受け取るまでの時間が60秒以内である
- **SC-002**: 正常なリクエストに対して、100%の確率で分析結果・アーキテクチャ・仕様書草稿を含むレスポンスが返される
- **SC-003**: 不正なリクエストに対して、適切なHTTPステータスコード（400, 504, 500）とエラーメッセージが返される
- **SC-004**: 生成された仕様書の90%以上がD1データベースに正常に保存される
- **SC-005**: curlまたはwrangler dev経由でAPIを呼び出し、仕様書草稿を確認できる（Phase 1-6の動作確認テストで検証）
- **SC-006**: 同時に5件のリクエストが来た場合でも、すべてのリクエストが60秒以内に処理される

## Assumptions

- Mastraの`generateSpec`ワークフローは既に実装済み（Phase 1-3完了）
- Gemini 2.5 Flash APIキーは環境変数`GOOGLE_GENERATIVE_AI_API_KEY`で提供される
- D1データベースの`specs`テーブルは`wrangler.toml`で定義され、マイグレーションスクリプトで作成される
- Cloudflare Workers環境では、リクエストのデフォルトタイムアウトは存在するが、明示的に60秒でタイムアウト処理を実装する
- Phase 1では認証・認可は実装せず、Phase 2以降で対応する
- エラー発生時のログはConsole APIで出力し、後続フェーズでCloudflare Logsと統合する

## Dependencies

- Phase 1-1完了（mastra, @mastra/core, @ai-sdk/googleインストール済み）
- Phase 1-2完了（mastra.config.ts作成、Gemini 2.5 Flash設定済み）
- Phase 1-3完了（generateSpecワークフロー実装済み）
- D1バインディング設定（Phase 1-5で実装予定だが、Phase 1-4では先行してスキーマ定義が必要）
- wrangler.tomlにD1バインディング`dev_architect_db`が設定されている

## Out of Scope

- 認証・認可機能（Phase 2以降）
- セッション管理・会話履歴（Phase 2）
- Web UI（Phase 2-3）
- PDFアップロード・解析（Phase 3）
- 仕様書の更新・削除API（Phase 2以降）
- レート制限・DDoS対策（Phase 4以降）
- 多言語対応（初期は日本語のみ）
