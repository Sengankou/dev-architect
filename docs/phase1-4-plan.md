# Phase 1-4 実装計画: /api/spec エンドポイント

**作成日**: 2025-10-24  
**ステータス**: 実装準備完了  
**前提条件**: Phase 1-3完了（generateSpecワークフロー実装済み）

---

## 📋 概要

Phase 1-4では、`POST /api/spec`エンドポイントを実装し、要件テキストから仕様書を生成するAPIを提供します。

---

## 🎯 目標

1. Honoで`/api/spec`エンドポイントを実装
2. generateSpecワークフローと統合
3. D1データベースに結果を永続化
4. 構造化されたエラーハンドリング

---

## 📐 仕様（Phase 1-4 明確化結果より）

### API仕様

**エンドポイント**: `POST /api/spec`

**リクエスト形式**:
```json
{
  "requirements": "string (必須)",
  "projectName": "string (オプション)"
}
```

**成功レスポンス形式** (200 OK):
```json
{
  "analysis": {
    "mainPurpose": "string",
    "targetUsers": "string",
    "keyFeatures": ["string"]
  },
  "architecture": {
    "techStack": ["string"],
    "deployment": "string",
    "scalability": "string"
  },
  "specificationDraft": "string (Markdown形式)"
}
```

**エラーレスポンス形式** (4xx/5xx):
```json
{
  "error": {
    "message": "string",
    "code": "string"
  }
}
```

**タイムアウト**: 60秒

### D1データベーススキーマ

**テーブル名**: `specs`

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT | 自動採番ID |
| requirements | TEXT | NOT NULL | 入力された要件テキスト |
| project_name | TEXT | NULL | プロジェクト名（オプション） |
| analysis_json | TEXT | NOT NULL | 要件分析結果（JSON文字列） |
| architecture_json | TEXT | NOT NULL | アーキテクチャ提案（JSON文字列） |
| spec_draft | TEXT | NOT NULL | 生成された仕様書（Markdown） |
| created_at | INTEGER | NOT NULL | 作成日時（Unixタイムスタンプ） |

---

## 🔧 実装タスク

### タスク1: D1マイグレーションスクリプト作成

**ファイル**: `migrations/0001_create_specs_table.sql`

```sql
-- 仕様書テーブルの作成
CREATE TABLE IF NOT EXISTS specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirements TEXT NOT NULL,
  project_name TEXT,
  analysis_json TEXT NOT NULL,
  architecture_json TEXT NOT NULL,
  spec_draft TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- インデックス: 作成日時での検索用
CREATE INDEX IF NOT EXISTS idx_specs_created_at ON specs(created_at DESC);
```

**実行方法**:
```bash
# ローカル環境で実行
pnpm wrangler d1 execute dev_architect_db --local --file=./migrations/0001_create_specs_table.sql

# リモート環境で実行
pnpm wrangler d1 execute dev_architect_db --remote --file=./migrations/0001_create_specs_table.sql
```

---

### タスク2: `src/routes/spec.ts` 実装

**ファイル**: `src/routes/spec.ts`

**機能**:
1. リクエストバリデーション（zod）
2. generateSpecワークフロー呼び出し
3. D1へのデータ保存
4. エラーハンドリング（構造化エラー）
5. タイムアウト処理（60秒）

**実装構造**:
```typescript
import { Hono } from "hono";
import { z } from "zod";
import { executeGenerateSpec } from "../mastra/workflows/generateSpec";

// リクエストスキーマ
const GenerateSpecRequest = z.object({
  requirements: z.string().min(1),
  projectName: z.string().optional(),
});

// ルーター作成
const spec = new Hono<{ Bindings: Env }>();

// POST /api/spec エンドポイント
spec.post("/", async (c) => {
  try {
    // 1. バリデーション
    const body = await c.req.json();
    const input = GenerateSpecRequest.parse(body);

    // 2. タイムアウト設定（60秒）
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("TIMEOUT")), 60000)
    );

    // 3. ワークフロー実行
    const result = await Promise.race([
      executeGenerateSpec(input),
      timeoutPromise,
    ]);

    // 4. D1保存
    const stmt = c.env.dev_architect_db.prepare(`
      INSERT INTO specs (requirements, project_name, analysis_json, architecture_json, spec_draft, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      input.requirements,
      input.projectName || null,
      JSON.stringify(result.analysis),
      JSON.stringify(result.architecture),
      result.specificationDraft,
      Date.now()
    ).run();

    // 5. レスポンス
    return c.json(result);

  } catch (error) {
    // エラーハンドリング
    if (error instanceof z.ZodError) {
      return c.json({
        error: {
          message: "Invalid request format",
          code: "VALIDATION_ERROR",
        },
      }, 400);
    }

    if (error.message === "TIMEOUT") {
      return c.json({
        error: {
          message: "Request timeout (60s exceeded)",
          code: "TIMEOUT",
        },
      }, 504);
    }

    return c.json({
      error: {
        message: error instanceof Error ? error.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
    }, 500);
  }
});

export default spec;
```

---

### タスク3: `src/index.ts` 更新

**変更内容**:
1. specルートのインポート
2. `/api/spec`へのルート登録
3. グローバルエラーハンドラー追加（オプション）

```typescript
import { Hono } from "hono";
import spec from "./routes/spec";

const app = new Hono<{ Bindings: Env }>();

// 既存のルート
app.get("/api", (c) =>
  c.json({ message: "dev-architect API running", version: "1.0.0" }),
);

app.get("/message", (c) => c.text("Dev Architect - 要件定義支援エージェント"));

// 新規: /api/spec ルート
app.route("/api/spec", spec);

// KVテスト（既存）
app.get("/api/kv", async (c) => {
  // ... 既存コード ...
});

export default app;
```

---

### タスク4: `wrangler.toml` 設定

**変更内容**:
1. D1データベースバインディング設定
2. 環境変数の定義

```toml
name = "dev-architect"
main = "src/index.ts"
compatibility_date = "2024-10-24"

# D1データベース
[[d1_databases]]
binding = "dev_architect_db"
database_name = "dev-architect-db"
database_id = "<database_id>"  # wrangler d1 create で取得

# KVネームスペース（既存）
[[kv_namespaces]]
binding = "DEV_ARCHITECT_SESSIONS"
id = "<kv_id>"

# R2バケット（既存）
[[r2_buckets]]
binding = "dev_architect_uploads"
bucket_name = "dev-architect-uploads"

# 環境変数（開発用）
[vars]
NODE_ENV = "development"

# シークレット（本番用）
# wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

**セットアップコマンド**:
```bash
# D1データベース作成
pnpm wrangler d1 create dev-architect-db

# 出力されたdatabase_idをwrangler.tomlに設定

# APIキーを設定（ローカル開発）
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-api-key" > .dev.vars

# APIキーを設定（本番環境）
pnpm wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
```

---

## 🔍 Constitution Check

| 原則 | 準拠状況 | 備考 |
|------|---------|------|
| I. 日本語ドキュメンテーション | ✅ | コメント・エラーメッセージ日本語 |
| II. テスト駆動開発 | ⚠️ Deferred | Phase 1はMVP、Phase 2でテスト追加 |
| III. 対話型要件整理 | ✅ | Phase 2で実装予定 |
| IV. 技術スタック標準 | ✅ | Hono, Mastra, Cloudflare Workers準拠 |
| V. 仕様書品質保証 | ✅ | 3段階生成フロー実装 |
| VI. Cloudflareアーキテクチャ | ✅ | D1, Workers, タイムアウト考慮 |
| VII. 進捗管理と可視化 | ✅ | PROGRESS.md常時更新 |
| VIII. コミット管理 | ✅ | 小さい粒度でコミット提案 |

**TDD遅延の正当化**: Phase 1はMVPとして最小機能を確認する段階。Phase 2でテストを追加し、品質を担保する戦略を採用。

---

## 📦 成果物

```
dev-architect/
├── migrations/
│   └── 0001_create_specs_table.sql    # 新規: D1テーブル作成
├── src/
│   ├── index.ts                        # 更新: specルート統合
│   └── routes/
│       └── spec.ts                     # 新規: /api/specエンドポイント
├── wrangler.toml                       # 更新: D1バインディング設定
└── .dev.vars                           # 新規: ローカル環境変数
```

---

## ✅ 完了条件

- [ ] `POST /api/spec`にJSONリクエストを送ると、仕様書が返る
- [ ] D1 `specs`テーブルに1件レコードが保存される
- [ ] エラー時に構造化エラーレスポンスが返る
- [ ] タイムアウト（60秒）が正しく動作する
- [ ] TypeScript型チェックが通る

---

## 🧪 動作確認方法（Phase 1-6で実施）

```bash
# 開発サーバー起動
pnpm run dev

# リクエスト送信
curl -X POST http://localhost:8787/api/spec \
  -H "Content-Type: application/json" \
  -d '{
    "requirements": "ユーザー認証機能付きのタスク管理アプリ",
    "projectName": "TaskMaster"
  }'

# D1確認
pnpm wrangler d1 execute dev_architect_db --local \
  --command "SELECT * FROM specs ORDER BY created_at DESC LIMIT 1"
```

---

## 📝 次のステップ

Phase 1-4完了後:
- **Phase 1-5**: KV/D1バインディング統合（セッション管理基盤）
- **Phase 1-6**: 動作確認テスト（curl/wrangler dev経由）
