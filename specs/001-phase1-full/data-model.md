# Data Model: /api/specエンドポイント

**作成日**: 2025-10-24
**Phase**: 1-4
**データベース**: Cloudflare D1

## 概要

Phase 1-4では、`specs`テーブルを作成し、AIが生成した仕様書データを永続化します。このテーブルは将来的にPhase 2以降でセッション管理や履歴機能の基盤となります。

---

## specsテーブル

### テーブル定義

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 仕様書の一意識別子（自動採番） |
| `requirements` | TEXT | NOT NULL | エンジニアリングマネージャーが入力した要件テキスト |
| `project_name` | TEXT | NULL | プロジェクト名（任意） |
| `analysis_json` | TEXT | NOT NULL | AI分析結果（JSON形式） |
| `architecture_json` | TEXT | NOT NULL | アーキテクチャ提案（JSON形式） |
| `spec_draft` | TEXT | NOT NULL | 仕様書草稿（Markdown形式） |
| `created_at` | INTEGER | NOT NULL | 作成日時（Unixタイムスタンプ、ミリ秒） |

### インデックス

| インデックス名 | カラム | 目的 |
|---------------|--------|------|
| `idx_specs_created_at` | `created_at DESC` | 最新の仕様書を高速に取得 |

### マイグレーションSQL

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

---

## TypeScript型定義

### エンティティ型

```typescript
// src/types/entities.ts

/**
 * specsテーブルの行データ
 */
export type SpecRow = {
  id: number
  requirements: string
  project_name: string | null
  analysis_json: string  // JSON文字列
  architecture_json: string  // JSON文字列
  spec_draft: string  // Markdown文字列
  created_at: number  // Unixタイムスタンプ（ミリ秒）
}

/**
 * AI分析結果の構造
 */
export type Analysis = {
  summary: string
  keyPoints: string[]
  actors: string[]
  mainFeatures: string[]
}

/**
 * アーキテクチャ提案の構造
 */
export type Architecture = {
  overview: string
  components: Array<{
    name: string
    description: string
    responsibilities: string[]
  }>
  dataFlow: string
  technologies: string[]
}

/**
 * アプリケーションレベルのSpec型（JSON解析済み）
 */
export type Spec = {
  id: number
  requirements: string
  projectName: string | null
  analysis: Analysis
  architecture: Architecture
  specDraft: string
  createdAt: Date
}
```

### リクエスト/レスポンス型

```typescript
// src/types/request.ts

/**
 * POST /api/spec リクエストボディ
 */
export type SpecRequest = {
  requirements: string  // 必須、最小1文字、最大100KB
  projectName?: string  // 任意
}
```

```typescript
// src/types/response.ts

/**
 * POST /api/spec 成功レスポンス
 */
export type SpecResponse = {
  analysis: Analysis
  architecture: Architecture
  specificationDraft: string
}

/**
 * エラーレスポンス
 */
export type ErrorResponse = {
  error: {
    message: string
    code: 'INVALID_REQUEST' | 'PAYLOAD_TOO_LARGE' | 'LLM_PARSE_ERROR' | 'TIMEOUT' | 'INTERNAL_ERROR'
  }
}
```

---

## データフロー

### 1. リクエスト受信

```
Client → POST /api/spec
{
  "requirements": "ユーザー認証機能を実装したい",
  "projectName": "MyApp"
}
```

### 2. Mastraワークフロー呼び出し

```
Hono Handler → Mastra generateSpec Workflow
Input: { requirements, projectName }
```

### 3. LLM処理

```
Mastra → Gemini 2.5 Flash API
Gemini → JSON Response {
  analysis: { ... },
  architecture: { ... },
  specificationDraft: "..."
}
```

### 4. D1保存

```typescript
await db.prepare(`
  INSERT INTO specs (requirements, project_name, analysis_json, architecture_json, spec_draft, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)
.bind(
  requirements,                    // TEXT
  projectName ?? null,             // TEXT | NULL
  JSON.stringify(analysis),        // TEXT (JSON)
  JSON.stringify(architecture),    // TEXT (JSON)
  specificationDraft,              // TEXT (Markdown)
  Date.now()                       // INTEGER (Unixタイムスタンプ)
)
.run()
```

### 5. レスポンス返却

```
Hono Handler → Client
{
  "analysis": { ... },
  "architecture": { ... },
  "specificationDraft": "..."
}
```

---

## データ制約

### サイズ制約

| 項目 | 制約 | 理由 |
|------|------|------|
| リクエストボディ | 最大100KB | Cloudflare Workersメモリ制約、ペイロードサイズ制限 |
| requirements | 最大100KB | リクエストボディ全体の制約に含まれる |
| project_name | 最大255文字（推奨） | 一般的なプロジェクト名の長さ |
| analysis_json | 制約なし（実質的には数KB程度） | LLMレスポンスサイズ依存 |
| architecture_json | 制約なし（実質的には数KB程度） | LLMレスポンスサイズ依存 |
| spec_draft | 制約なし（実質的には数十KB程度） | LLMレスポンスサイズ依存 |

### バリデーション

```typescript
import { z } from 'zod'

const specRequestSchema = z.object({
  requirements: z.string()
    .min(1, 'Requirements is required')
    .max(100 * 1024, 'Requirements must not exceed 100KB'),
  projectName: z.string()
    .max(255, 'Project name must not exceed 255 characters')
    .optional(),
})
```

---

## データ整合性

### NOT NULL制約

- `requirements`: ユーザー入力必須
- `analysis_json`: Mastraワークフロー出力必須
- `architecture_json`: Mastraワークフロー出力必須
- `spec_draft`: Mastraワークフロー出力必須
- `created_at`: システムタイムスタンプ必須

### NULL許容

- `project_name`: プロジェクト名は任意項目

### JSON形式検証

アプリケーションレベルでJSON形式を検証：

```typescript
try {
  const analysis: Analysis = JSON.parse(row.analysis_json)
  const architecture: Architecture = JSON.parse(row.architecture_json)
} catch (error) {
  console.error('Invalid JSON in D1 row', error)
  throw new Error('Data corruption: Invalid JSON')
}
```

---

## パフォーマンス考慮事項

### インデックス戦略

- **created_at降順インデックス**: 最新の仕様書を高速取得（Phase 2の履歴機能で使用）
- 将来的な拡張：
  - `project_name`のインデックス（プロジェクトごとの仕様書一覧）
  - 全文検索インデックス（requirements内のキーワード検索）

### クエリ最適化

```sql
-- ❌ 非効率（インデックス未使用）
SELECT * FROM specs ORDER BY id DESC LIMIT 10;

-- ✅ 効率的（インデックス使用）
SELECT * FROM specs ORDER BY created_at DESC LIMIT 10;
```

### D1制限事項

- **単一クエリ実行時間**: 最大30秒
- **batch()実行時間**: 最大30秒
- **単一ステートメントサイズ**: 最大100KB
- **rows_read/rows_written**: 制限なし（ただし実行時間制約内）

---

## 将来的な拡張（Phase 2以降）

### Phase 2: セッション管理

```sql
-- sessionsテーブル追加
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- specsテーブルにsession_id追加
ALTER TABLE specs ADD COLUMN session_id TEXT;
CREATE INDEX idx_specs_session_id ON specs(session_id);
```

### Phase 3: ドキュメント管理

```sql
-- documentsテーブル追加
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  spec_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (spec_id) REFERENCES specs(id)
);
```

---

## リポジトリパターン実装例

```typescript
// src/repositories/spec-repository.ts

export class SpecRepository {
  constructor(private db: D1Database) {}

  async create(spec: {
    requirements: string
    projectName: string | null
    analysis: Analysis
    architecture: Architecture
    specDraft: string
  }): Promise<number> {
    const result = await this.db
      .prepare(`
        INSERT INTO specs (requirements, project_name, analysis_json, architecture_json, spec_draft, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        spec.requirements,
        spec.projectName,
        JSON.stringify(spec.analysis),
        JSON.stringify(spec.architecture),
        spec.specDraft,
        Date.now()
      )
      .run()

    if (!result.success) {
      throw new Error('Failed to insert spec')
    }

    // D1のlast_insert_rowidを取得
    const lastId = await this.db
      .prepare('SELECT last_insert_rowid() as id')
      .first<{ id: number }>()

    return lastId?.id ?? 0
  }

  async findById(id: number): Promise<Spec | null> {
    const row = await this.db
      .prepare('SELECT * FROM specs WHERE id = ?')
      .bind(id)
      .first<SpecRow>()

    if (!row) return null

    return {
      id: row.id,
      requirements: row.requirements,
      projectName: row.project_name,
      analysis: JSON.parse(row.analysis_json),
      architecture: JSON.parse(row.architecture_json),
      specDraft: row.spec_draft,
      createdAt: new Date(row.created_at),
    }
  }

  async findLatest(limit: number = 10): Promise<Spec[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM specs ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all<SpecRow>()

    return results.map(row => ({
      id: row.id,
      requirements: row.requirements,
      projectName: row.project_name,
      analysis: JSON.parse(row.analysis_json),
      architecture: JSON.parse(row.architecture_json),
      specDraft: row.spec_draft,
      createdAt: new Date(row.created_at),
    }))
  }
}
```

---

**作成日**: 2025-10-24
**最終更新**: 2025-10-24
