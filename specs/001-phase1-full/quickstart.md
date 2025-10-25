# Quickstart: /api/specエンドポイント

**作成日**: 2025-10-24  
**Phase**: 1-4  
**所要時間**: 約10分

## 前提条件

- Node.js 18以上
- pnpm（推奨）またはnpm
- Cloudflare Workersアカウント
- Gemini API キー（環境変数`GOOGLE_GENERATIVE_AI_API_KEY`）

---

## セットアップ手順

### 1. リポジトリのクローンと依存関係インストール

```bash
# リポジトリルートに移動
cd /path/to/dev-architect

# 依存関係インストール
pnpm install

# TypeScript型チェック
npx tsc --noEmit
```

### 2. 環境変数設定

`.dev.vars`ファイルを作成：

```bash
# .dev.vars
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

**注意**: このファイルは`.gitignore`に含まれており、Gitにコミットされません。

### 3. D1データベースのセットアップ

#### マイグレーション作成（既存の場合はスキップ）

```bash
wrangler d1 migrations create dev_architect_db create_specs_table
```

#### マイグレーション適用（ローカル）

```bash
wrangler d1 migrations apply dev_architect_db --local
```

#### 確認

```bash
wrangler d1 execute dev_architect_db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

**期待される出力**:
```
name
----
specs
d1_migrations
```

### 4. 開発サーバー起動

```bash
pnpm run dev
```

**期待される出力**:
```
⛅️ wrangler 4.43.0
-------------------
wrangler dev now uses local mode by default
Your worker has access to the following bindings:
- D1 Databases:
  - dev_architect_db: dev_architect_db (87dac84e-d9a7-4f1f-8a93-a34f581534c3)
- KV Namespaces:
  - DEV_ARCHITECT_SESSIONS: (210ebeec775d423eacb1e756f4247fe0)
- R2 Buckets:
  - dev_architect_uploads

⎔ Starting local server...
Ready on http://localhost:8787
```

---

## エンドポイントの動作確認

### テストケース1: 基本的な仕様書生成

```bash
curl -X POST http://localhost:8787/api/spec \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "ユーザー認証機能を実装したい"
  }'
```

**期待されるレスポンス** (200 OK):
```json
{
  "analysis": {
    "summary": "ユーザー認証システムの実装",
    "keyPoints": ["セキュアなパスワード管理", "セッション管理"],
    "actors": ["エンドユーザー"],
    "mainFeatures": ["ログイン/ログアウト", "パスワードリセット"]
  },
  "architecture": {
    "overview": "3層アーキテクチャでの実装",
    "components": [
      {
        "name": "認証サービス",
        "description": "ユーザー認証を担当",
        "responsibilities": ["パスワード検証", "トークン発行"]
      }
    ],
    "dataFlow": "クライアント → APIゲートウェイ → 認証サービス → データベース",
    "technologies": ["JWT", "bcrypt"]
  },
  "specificationDraft": "# ユーザー認証機能仕様書\n\n..."
}
```

### テストケース2: プロジェクト名付き

```bash
curl -X POST http://localhost:8787/api/spec \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "ユーザー認証機能を実装したい",
    "projectName": "MyApp"
  }'
```

### テストケース3: バリデーションエラー（空の要件）

```bash
curl -X POST http://localhost:8787/api/spec \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": ""
  }'
```

**期待されるレスポンス** (400 Bad Request):
```json
{
  "error": {
    "message": "requirements is required",
    "code": "INVALID_REQUEST"
  }
}
```

### テストケース4: ペイロード過大

```bash
# 100KBを超える大きなファイルを生成
dd if=/dev/zero bs=1024 count=101 | base64 > large_payload.txt

# リクエスト送信
curl -X POST http://localhost:8787/api/spec \
  -H "Content-Type: application/json" \
  -d "{\"requirements\": \"$(cat large_payload.txt)\"}"
```

**期待されるレスポンス** (413 Payload Too Large):
```json
{
  "error": {
    "message": "Request body too large",
    "code": "PAYLOAD_TOO_LARGE"
  }
}
```

---

## D1データベースの確認

### 保存されたデータの確認

```bash
wrangler d1 execute dev_architect_db --local --command "SELECT id, requirements, project_name, created_at FROM specs ORDER BY created_at DESC LIMIT 5"
```

**期待される出力**:
```
id | requirements                 | project_name | created_at
---|------------------------------|--------------|----------------
1  | ユーザー認証機能を実装したい | MyApp        | 1730000000000
2  | ユーザー認証機能を実装したい | NULL         | 1729999900000
```

### 全データの削除（テスト後のクリーンアップ）

```bash
wrangler d1 execute dev_architect_db --local --command "DELETE FROM specs"
```

---

## トラブルシューティング

### エラー: `GOOGLE_GENERATIVE_AI_API_KEY is not defined`

**原因**: 環境変数が設定されていない

**解決策**:
1. `.dev.vars`ファイルが存在し、APIキーが記載されているか確認
2. `pnpm run dev`を再起動

### エラー: `no such table: specs`

**原因**: D1マイグレーションが未適用

**解決策**:
```bash
wrangler d1 migrations apply dev_architect_db --local
```

### エラー: `Request timeout`

**原因**: Gemini APIの応答が60秒を超えた

**解決策**:
1. Gemini APIキーの有効性を確認
2. 要件テキストを簡潔にする
3. ネットワーク接続を確認

### ポート8787が既に使用中

**解決策**:
```bash
# 別のポートを指定
wrangler dev --port 8788
```

---

## 次のステップ

### Phase 1-5: KV/D1バインディング統合

- セッションIDをKVに保存
- D1への保存をベストエフォート型で実装
- エラーハンドリングの強化

### Phase 1-6: 動作確認テスト

- 統合テストスイートの作成
- Vitestでの自動テスト
- curl/wrangler dev経由での手動テスト

---

## 参考資料

### プロジェクト内ドキュメント

- [spec.md](./spec.md) - 機能仕様書
- [plan.md](./plan.md) - 実装計画
- [research.md](./research.md) - 技術調査結果
- [data-model.md](./data-model.md) - データモデル定義
- [contracts/api-spec.openapi.yaml](./contracts/api-spec.openapi.yaml) - OpenAPI仕様

### 外部リソース

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Hono Framework](https://hono.dev/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [D1 Database](https://developers.cloudflare.com/d1/)

---

**作成日**: 2025-10-24  
**最終更新**: 2025-10-24
