# Phase 0: リサーチ結果

**作成日**: 2025-10-24  
**対象フェーズ**: Phase 1-4 /api/specエンドポイント実装

## 概要

Phase 1-4の実装に必要な5つの技術領域について調査を実施しました。本ドキュメントでは、各技術の推奨アプローチ、実装例、ベストプラクティスをまとめています。

---

## 1. Honoでのペイロードサイズ制限

### 決定事項

**採用アプローチ**: Hono 4.10.1のビルトイン`bodyLimit`ミドルウェアを使用

### 理由

- RFC 7230準拠の2段階チェック（Content-Lengthヘッダー → ストリーミング監視）
- シンプルで宣言的な実装
- カスタムエラーハンドリング対応
- Cloudflare Workers環境で最適化済み

### 実装方針

```typescript
import { bodyLimit } from 'hono/body-limit'

// 100KB制限を/api/specエンドポイントに適用
app.post(
  '/api/spec',
  bodyLimit({
    maxSize: 100 * 1024, // 100KB
    onError: (c) => {
      return c.json(
        { 
          error: {
            message: 'Request body too large',
            code: 'PAYLOAD_TOO_LARGE'
          }
        },
        413
      )
    },
  }),
  async (c) => {
    // ハンドラー処理
  }
)
```

### 代替案と不採用理由

- **手動実装（Content-Lengthチェック）**: ビルトインミドルウェアがRFC準拠でより堅牢
- **Cloudflareプラットフォーム制限のみ**: アプリケーションレベルで制限することでリソース消費を最適化

### 参考資料

- [Hono Body Limit Middleware](https://hono.dev/docs/middleware/builtin/body-limit)
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

---

## 2. Cloudflare WorkersでのD1データベース操作

### 決定事項

**マイグレーション管理**: `wrangler d1 migrations`コマンドを使用  
**トランザクション処理**: `batch()`による擬似トランザクション（完全なACIDではない）  
**エラーハンドリング**: 読み取りクエリは自動リトライ、書き込みクエリは手動リトライ実装

### 理由

- wrangler CLIがマイグレーション管理を標準サポート
- `batch()`は複数SQL文を1回のネットワーク呼び出しで実行可能（レイテンシ削減）
- D1の自動リトライ機能を活用しつつ、冪等な書き込みは手動リトライで補完

### 実装方針

#### マイグレーションファイル作成

```bash
# マイグレーション作成
wrangler d1 migrations create dev_architect_db create_specs_table

# ローカル適用
wrangler d1 migrations apply dev_architect_db --local

# 本番適用
wrangler d1 migrations apply dev_architect_db --remote
```

#### specsテーブルスキーマ

```sql
-- migrations/0001_create_specs_table.sql
CREATE TABLE IF NOT EXISTS specs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requirements TEXT NOT NULL,
  project_name TEXT,
  analysis_json TEXT NOT NULL,
  architecture_json TEXT NOT NULL,
  spec_draft TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_specs_created_at ON specs(created_at DESC);
```

#### TypeScript実装例

```typescript
type SpecRow = {
  id: number;
  requirements: string;
  project_name: string | null;
  analysis_json: string;
  architecture_json: string;
  spec_draft: string;
  created_at: number;
};

// データ挿入
const result = await c.env.dev_architect_db
  .prepare(`
    INSERT INTO specs (requirements, project_name, analysis_json, architecture_json, spec_draft, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  .bind(
    requirements,
    projectName ?? null,
    JSON.stringify(analysis),
    JSON.stringify(architecture),
    specDraft,
    Date.now()
  )
  .run<SpecRow>();

if (!result.success) {
  console.error('D1 insert failed');
  // ベストエフォート型：エラーログのみ記録
}
```

### 重要な制限事項

- **batch()は完全なトランザクションではない**: 途中失敗しても以前のステートメントはコミット済み
- **バッチ全体は30秒以内に完了必須**
- **各ステートメントは最大100KB**
- **undefinedではなくnullを使用**: `undefined`は`D1_TYPE_ERROR`を引き起こす

### ローカル開発環境

- `.wrangler/state/v3/d1/dev_architect_db.sqlite3`にローカルデータが永続化
- `pnpm run dev`でローカルD1環境が自動起動
- wrangler.jsoncの`d1_databases`設定は既に完了済み

### 参考資料

- [D1 Worker API](https://developers.cloudflare.com/d1/worker-api/)
- [D1 Migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Local Development](https://developers.cloudflare.com/d1/best-practices/local-development/)

---

## 3. Cloudflare Workersでのタイムアウト処理

### 決定事項

**採用アプローチ**: Hono `timeout`ミドルウェア + `AbortSignal.timeout()`の併用

### 理由

- Honoミドルウェアは宣言的で保守性が高い
- `AbortSignal.timeout()`はES2024標準APIで将来性がある
- Cloudflare WorkersのCPU時間制限（30秒デフォルト、最大5分）とは別の概念

### 実装方針

#### 基本実装（Honoミドルウェア）

```typescript
import { timeout } from 'hono/timeout'
import { HTTPException } from 'hono/http-exception'

const timeoutException = () =>
  new HTTPException(504, {
    message: 'Request timeout',
  })

// 60秒タイムアウトを/api/specに適用
app.post('/api/spec', timeout(60000, timeoutException), async (c) => {
  // Mastraワークフロー呼び出し
})
```

#### LLM API呼び出しへの適用

```typescript
// Mastraワークフロー内でのタイムアウト
const response = await fetch('https://generativelanguage.googleapis.com/...', {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify(prompt),
  signal: AbortSignal.timeout(60000), // 60秒タイムアウト
})
```

### CPU時間 vs ウォールクロック時間

**重要**: Cloudflare WorkersのCPU時間制限とリクエストタイムアウトは別概念

- **CPU時間**: CPUが実際に処理を実行している時間のみカウント
- **ウォールクロック時間**: 実際の経過時間

**実用的な意味**:
- LLM APIへのfetchリクエスト待機時間はCPU時間にカウントされない
- 60秒のタイムアウトは問題なく設定可能（CPUは数秒しか使用しない）

### クリーンアップ処理

```typescript
// タイマーは必ずクリア
const timeoutId = setTimeout(() => controller.abort(), 60000)
try {
  return await fetch(url, { signal: controller.signal })
} finally {
  clearTimeout(timeoutId) // 成功・失敗に関わらず必ず実行
}
```

### 参考資料

- [Cloudflare Workers実行制限](https://developers.cloudflare.com/workers/platform/limits/)
- [Hono Timeout Middleware](https://hono.dev/docs/middleware/builtin/timeout)
- [MDN AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static)

---

## 4. Vitest + Cloudflare Workers環境構築

### 決定事項

**テストフレームワーク**: Vitest + @cloudflare/vitest-pool-workers  
**D1モック方法**: 実際のD1環境を使用（隔離されたインスタンスが自動作成される）

### 理由

- `@cloudflare/vitest-pool-workers`はCloudflare公式の統合
- テストごとに隔離されたD1/KV/R2インスタンスが自動作成されるため、モックライブラリ不要
- 実際のCloudflare Workers環境に近い状態でテスト可能

### 実装方針

#### パッケージインストール

```bash
pnpm add -D vitest @cloudflare/vitest-pool-workers
```

#### vitest.config.ts設定

```typescript
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import path from 'node:path'

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations')
  const migrations = await readD1Migrations(migrationsPath)

  return {
    test: {
      globals: true,
      setupFiles: ['./test/setup.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          isolatedStorage: false,
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: {
            compatibilityFlags: ['nodejs_compat'],
            compatibilityDate: '2024-09-09',
            d1Databases: ['dev_architect_db'],
            bindings: { TEST_MIGRATIONS: migrations }
          }
        }
      }
    }
  }
})
```

#### テストセットアップ（test/setup.ts）

```typescript
import { applyD1Migrations, env } from 'cloudflare:test'
import { beforeAll } from 'vitest'

beforeAll(async () => {
  const migrations = env.TEST_MIGRATIONS as unknown as Migration[]
  await applyD1Migrations(env.dev_architect_db, migrations)
})
```

#### テスト実装例

```typescript
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('POST /api/spec', () => {
  it('should create spec and save to D1', async () => {
    const res = await app.request(
      'http://localhost/api/spec',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements: 'ユーザー認証機能',
          projectName: 'TestProject'
        })
      },
      env
    )

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('analysis')
    expect(data).toHaveProperty('architecture')
    expect(data).toHaveProperty('specificationDraft')

    // D1に保存されているか確認
    const saved = await env.dev_architect_db
      .prepare('SELECT * FROM specs ORDER BY created_at DESC LIMIT 1')
      .first()
    
    expect(saved).toBeDefined()
    expect(saved?.requirements).toBe('ユーザー認証機能')
  })
})
```

### Mastraワークフローのモック

```typescript
import { vi } from 'vitest'

vi.mock('../src/mastra/workflows/generateSpec', () => ({
  generateSpec: {
    execute: vi.fn().mockResolvedValue({
      analysis: { /* モックデータ */ },
      architecture: { /* モックデータ */ },
      specificationDraft: 'モック仕様書'
    })
  }
}))
```

### 参考資料

- [Cloudflare Workers Vitest統合](https://developers.cloudflare.com/workers/testing/vitest-integration/)
- [@cloudflare/vitest-pool-workers](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers)
- [Hono Testing with Cloudflare](https://hono.dev/examples/cloudflare-vitest)

---

## 5. Honoエラーハンドリングベストプラクティス

### 決定事項

**グローバルエラーハンドラー**: `app.onError()`を使用  
**エラーレスポンス形式**: `{success: false, error: {message, status, code, details?}, timestamp}`  
**zodバリデーション**: `zValidator`のフック機能でカスタムエラーレスポンス

### 理由

- `app.onError()`で全エラーを一元管理し、一貫性を確保
- HTTPExceptionとZodErrorを適切に区別して処理
- クライアントがエラータイプを識別しやすいcode付き

### 実装方針

#### グローバルエラーハンドラー

```typescript
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

type ErrorResponse = {
  success: false
  error: {
    message: string
    status: number
    code: string
    details?: unknown
  }
  timestamp: string
}

const app = new Hono<{ Bindings: Env }>()

app.onError((err, c) => {
  console.error('Error:', err)

  if (err instanceof HTTPException) {
    return c.json<ErrorResponse>({
      success: false,
      error: {
        message: err.message,
        status: err.status,
        code: getErrorCode(err.status),
      },
      timestamp: new Date().toISOString(),
    }, err.status)
  }

  if (err instanceof ZodError) {
    return c.json<ErrorResponse>({
      success: false,
      error: {
        message: 'Validation failed',
        status: 400,
        code: 'INVALID_REQUEST',
        details: err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      },
      timestamp: new Date().toISOString(),
    }, 400)
  }

  if (err.name === 'TimeoutError') {
    return c.json<ErrorResponse>({
      success: false,
      error: {
        message: 'Request timeout',
        status: 504,
        code: 'TIMEOUT',
      },
      timestamp: new Date().toISOString(),
    }, 504)
  }

  return c.json<ErrorResponse>({
    success: false,
    error: {
      message: 'Internal server error',
      status: 500,
      code: 'INTERNAL_ERROR',
    },
    timestamp: new Date().toISOString(),
  }, 500)
})

function getErrorCode(status: number): string {
  const codes: Record<number, string> = {
    400: 'INVALID_REQUEST',
    413: 'PAYLOAD_TOO_LARGE',
    500: 'INTERNAL_ERROR',
    504: 'TIMEOUT',
  }
  return codes[status] || 'UNKNOWN_ERROR'
}
```

#### zodバリデーション統合

```typescript
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

const specRequestSchema = z.object({
  requirements: z.string().min(1, 'Requirements is required'),
  projectName: z.string().optional(),
})

app.post(
  '/api/spec',
  zValidator('json', specRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json<ErrorResponse>({
        success: false,
        error: {
          message: 'Validation failed',
          status: 400,
          code: 'INVALID_REQUEST',
          details: result.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        timestamp: new Date().toISOString(),
      }, 400)
    }
  }),
  async (c) => {
    const { requirements, projectName } = c.req.valid('json')
    // ハンドラー処理
  }
)
```

### HTTPステータスコード使用ガイド

| コード | 用途 | 例 |
|--------|------|-----|
| 400 | クライアント側の汎用エラー | リクエスト形式不正、必須パラメータ欠落 |
| 413 | ペイロード過大 | 100KBを超えるリクエストボディ |
| 500 | サーバー側の予期しないエラー | データベースエラー、予期しない例外 |
| 504 | ゲートウェイタイムアウト | LLM API呼び出しタイムアウト |

### エラーコード一覧

```typescript
export const ErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  LLM_PARSE_ERROR: 'LLM_PARSE_ERROR',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const
```

### 参考資料

- [Hono HTTPException](https://hono.dev/docs/api/exception)
- [Hono Validator Error Handling](https://hono.dev/examples/validator-error-handling)
- [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807)

---

## 次のステップ

Phase 0のリサーチが完了しました。次はPhase 1: Design & Contractsに進みます。

### Phase 1で作成するドキュメント

1. **data-model.md**: `specs`テーブルのD1スキーマ詳細定義
2. **contracts/api-spec.openapi.yaml**: OpenAPI 3.0仕様
3. **quickstart.md**: 開発環境セットアップとエンドポイント動作確認手順

---

**作成日**: 2025-10-24  
**最終更新**: 2025-10-24
