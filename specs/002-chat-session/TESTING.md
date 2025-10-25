# Phase 2 テスト戦略

**Feature**: 対話フロー + セッション管理  
**Status**: 手動テスト実施中  
**Last Updated**: 2025-10-25

---

## テスト戦略の背景

### 既知の技術的制約

**問題**: Mastra/OpenTelemetryが`node:os`モジュールを要求するため、Cloudflare Workers環境（vitest-pool-workers）では自動テストが実行不可能。

**対応**: Constitution原則II（TDD）を尊重しつつ、技術的制約により**手動テスト**で代替。

**記録**: `tasks.md` T019に記載済み

---

## 手動テスト手順

### 前提条件

1. **環境変数の設定**
   ```bash
   # .envファイルが存在すること
   cat .dev.vars > .env
   
   # APIキーの確認
   grep GOOGLE_GENERATIVE_AI_API_KEY .env
   ```

2. **依存関係のインストール**
   ```bash
   pnpm install
   ```

3. **開発サーバーの起動**
   ```bash
   pnpm run dev
   # 期待: Ready on http://localhost:8787
   ```

---

## テストケース

### TC-001: 新規セッション作成

**目的**: POST /api/chat で新規セッションを作成し、AI応答を取得

**手順**:
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ECサイトのカート機能を実装したいです"}' \
  | jq .
```

**期待結果**:
- ✅ HTTPステータス: 200
- ✅ レスポンスに`sessionId`（UUID形式）が含まれる
- ✅ レスポンスに`response`（日本語のAI応答）が含まれる
- ✅ サーバーログに以下が出力:
  - `Chat history loaded from KV` (messageCount: 0)
  - `AI response generated`
  - `Chat history saved to KV` (totalMessages: 2)
  - `New session created in D1` または `Session updated in D1`

**検証項目**:
- [ ] sessionIdがUUID v4形式
- [ ] responseが日本語で意味のある応答
- [ ] KVに会話履歴が保存される
- [ ] D1にセッションレコードが作成される

---

### TC-002: 既存セッション継続（会話コンテキスト保持）

**目的**: 同一sessionIdで2回目のメッセージを送信し、会話コンテキストが保持されることを確認

**前提**: TC-001で取得したsessionIdを使用

**手順**:
```bash
# TC-001のsessionIdを変数に設定
SESSION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"message\": \"はい、在庫管理も必要です\"}" \
  | jq .
```

**期待結果**:
- ✅ HTTPステータス: 200
- ✅ 同じ`sessionId`が返される
- ✅ AI応答が前回の会話を踏まえた内容（「在庫管理」「カート機能」に言及）
- ✅ サーバーログに`Chat history loaded from KV` (messageCount: 2)

**検証項目**:
- [ ] sessionIdが一致
- [ ] AI応答が文脈を理解している
- [ ] KVから会話履歴が正しく読み込まれる

---

### TC-003: 会話履歴取得

**目的**: GET /api/chat/:sessionId/history で会話履歴を取得

**手順**:
```bash
curl http://localhost:8787/api/chat/$SESSION_ID/history | jq .
```

**期待結果**:
- ✅ HTTPステータス: 200
- ✅ `messages`配列に4件のメッセージ（user×2, assistant×2）
- ✅ メッセージが`createdAt`の昇順でソート
- ✅ 各メッセージに`id`, `sessionId`, `role`, `content`, `createdAt`が含まれる

**検証項目**:
- [ ] messages[0].role === "user"
- [ ] messages[1].role === "assistant"
- [ ] messages[2].role === "user"
- [ ] messages[3].role === "assistant"
- [ ] createdAtが時系列順

---

### TC-004: バリデーションエラー - 空メッセージ

**目的**: 空文字列メッセージでバリデーションエラーを確認

**手順**:
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": ""}' \
  | jq .
```

**期待結果**:
- ✅ HTTPステータス: 400
- ✅ エラーレスポンス:
  ```json
  {
    "error": "message is required",
    "details": "リクエストボディに'message'フィールドが必要です"
  }
  ```

**検証項目**:
- [ ] ステータスコード400
- [ ] エラーメッセージが日本語

---

### TC-005: バリデーションエラー - messageフィールド欠落

**目的**: messageフィールドが存在しない場合のエラー

**手順**:
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-id"}' \
  | jq .
```

**期待結果**:
- ✅ HTTPステータス: 400
- ✅ エラー: "message is required"

---

### TC-006: バリデーションエラー - 制御文字

**目的**: NULL文字を含むメッセージでバリデーションエラー

**手順**:
```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d $'{"message": "テスト\x00メッセージ"}' \
  | jq .
```

**期待結果**:
- ✅ HTTPステータス: 400
- ✅ エラーレスポンス:
  ```json
  {
    "error": "invalid content",
    "details": "メッセージに不正な制御文字が含まれています"
  }
  ```

---

### TC-007: バリデーションエラー - サイズ超過

**目的**: 100KBを超えるメッセージでバリデーションエラー

**手順**:
```bash
# 約150KB（日本語50,000文字）のメッセージ
LARGE_MSG=$(python3 -c "print('あ' * 50000)")
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"$LARGE_MSG\"}" \
  | jq .
```

**期待結果**:
- ✅ HTTPステータス: 400
- ✅ エラーレスポンス:
  ```json
  {
    "error": "invalid content",
    "details": "メッセージは100KB以下である必要があります"
  }
  ```

---

### TC-008: 存在しないセッションの履歴取得

**目的**: 無効なsessionIdで履歴取得した場合の挙動

**手順**:
```bash
curl http://localhost:8787/api/chat/invalid-session-id/history | jq .
```

**期待結果**:
- ✅ HTTPステータス: 200（エラーではない）
- ✅ レスポンス:
  ```json
  {
    "sessionId": "invalid-session-id",
    "messages": [],
    "lastUpdatedAt": <timestamp>
  }
  ```

**検証項目**:
- [ ] messagesが空配列
- [ ] エラーではなく成功レスポンス

---

### TC-009: KV/D1永続化の確認

**目的**: データが正しくKVとD1に保存されることを確認

**手順**:
```bash
# KV確認
pnpm wrangler kv key list --binding=DEV_ARCHITECT_SESSIONS

# D1確認
pnpm wrangler d1 execute dev_architect_db --local \
  --command="SELECT * FROM sessions ORDER BY created_at DESC LIMIT 3;"

pnpm wrangler d1 execute dev_architect_db --local \
  --command="SELECT * FROM messages ORDER BY created_at DESC LIMIT 10;"
```

**期待結果**:
- ✅ KVに`chat:session:<sessionId>:messages`キーが存在
- ✅ D1の`sessions`テーブルにレコードが存在
- ✅ D1の`messages`テーブルに複数のメッセージが存在
- ✅ messages.session_idがsessions.idと一致

---

### TC-010: ログ出力の確認

**目的**: 構造化ログ（FR-021）が正しく出力されることを確認

**手順**: TC-001〜TC-003を実行中、開発サーバーのコンソール出力を監視

**期待される出力例**:
```json
{
  "level": "INFO",
  "message": "Chat history loaded from KV",
  "data": {
    "sessionId": "xxx",
    "messageCount": 0
  },
  "timestamp": "2025-10-25T..."
}

{
  "level": "INFO",
  "message": "AI response generated",
  "data": {
    "sessionId": "xxx",
    "responseLength": 234
  },
  "timestamp": "2025-10-25T..."
}

{
  "level": "INFO",
  "message": "Chat history saved to KV",
  "data": {
    "sessionId": "xxx",
    "totalMessages": 2
  },
  "timestamp": "2025-10-25T..."
}
```

**検証項目**:
- [ ] JSON形式のログ
- [ ] sessionId、timestamp、operationの詳細が含まれる
- [ ] エラー時はERRORレベル
- [ ] 成功時はINFOレベル

---

## テスト完了基準

以下すべてが✅であれば、Phase 2 User Story 1は合格:

- [ ] TC-001: 新規セッション作成
- [ ] TC-002: 既存セッション継続（コンテキスト保持）
- [ ] TC-003: 会話履歴取得
- [ ] TC-004: 空メッセージエラー
- [ ] TC-005: messageフィールド欠落エラー
- [ ] TC-006: 制御文字エラー
- [ ] TC-007: サイズ超過エラー
- [ ] TC-008: 存在しないセッション履歴
- [ ] TC-009: KV/D1永続化
- [ ] TC-010: 構造化ログ出力

---

## トラブルシューティング

### エラー: "Provider not connected"

**原因**: `.env`ファイルが存在しない

**対処**:
```bash
cat .dev.vars > .env
pnpm run dev  # サーバー再起動
```

### エラー: "Address already in use (127.0.0.1:8787)"

**対処**:
```bash
lsof -ti:8787 | xargs kill -9
pnpm run dev
```

### エラー: "models/gemini-2.5-flash is not found"

**原因**: Google Gemini APIキーが無効

**対処**:
1. [Google AI Studio](https://aistudio.google.com/app/apikey)で新しいAPIキーを取得
2. `.env`と`.dev.vars`を更新
3. サーバー再起動

---

## 将来の改善案（Phase 7: Polish）

1. **テストフレームワークの変更**
   - Vitest → Node.js環境でのテスト（Jest/Vitest with Node pool）
   - Mastraのモック化

2. **E2Eテスト自動化**
   - curlスクリプトの自動化
   - Playwright/Puppeteerでのブラウザテスト

3. **CI/CD統合**
   - GitHub Actionsで手動テストスクリプトを実行
   - デプロイ前の動作確認自動化

---

## 関連ドキュメント

- `tasks.md` - T019にテスト制約を記載
- `spec.md` - 機能要件（FR-013, FR-015, FR-021）
- `contracts/chat-api.yaml` - APIコントラクト仕様
