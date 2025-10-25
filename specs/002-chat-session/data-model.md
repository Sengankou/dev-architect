# Data Model: 対話フロー + セッション管理

**Feature**: Phase 2 - 対話フロー + セッション管理  
**Created**: 2025-10-25  
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

---

## Overview

Phase 2では、ユーザーとAIのマルチターン会話を実現するため、以下の新しいエンティティを導入します：

- **Session**: ユーザーとAIの一連の会話セッション
- **Message**: セッション内の個別のメッセージ（user/assistant）
- **ChatHistory**: KVストレージに保存される会話履歴のスナップショット

Phase 1の`Spec`エンティティは継続して使用し、1つのSessionから複数の仕様書（Spec）が生成される関係を想定します。

---

## Entities

### Session（セッション）

ユーザーとAIの一連の会話を表すエンティティ。セッションIDで識別され、複数のMessageを持ちます。

**Properties**:

| フィールド | 型 | 必須 | 説明 | バリデーション |
|:---------|:---|:-----|:-----|:-------------|
| `id` | `string` | ✅ | セッションID（UUIDv4形式） | UUID形式、一意性保証 |
| `createdAt` | `number` | ✅ | 作成日時（Unix epoch秒） | 正の整数 |
| `updatedAt` | `number` | ✅ | 最終更新日時（Unix epoch秒） | 正の整数、`createdAt`以降 |
| `status` | `string` | ✅ | ステータス（"active"/"archived"/"deleted"） | 列挙値、Phase 2では"active"のみ使用 |

**Lifecycle**:
1. **作成**: POST /api/chat（sessionId未指定時）で新規Session作成、UUIDv4自動生成
2. **更新**: メッセージ送信時に`updatedAt`を更新
3. **アーカイブ**: Phase 4以降で実装予定（`status`を"archived"に変更）
4. **削除**: Phase 4以降で実装予定（`status`を"deleted"に変更、CASCADE削除でメッセージも削除）

**Relationships**:
- **Session 1 ←→ N Message**: 1つのSessionは複数のMessageを持つ
- **Session 1 ←→ N Spec**: 1つのSessionから複数の仕様書（Spec）が生成される可能性（Phase 1のSpec typeと関連）

---

### Message（メッセージ）

セッション内の個別の発言を表すエンティティ。ユーザーまたはAI（assistant）の発言を記録します。

**Properties**:

| フィールド | 型 | 必須 | 説明 | バリデーション |
|:---------|:---|:-----|:-----|:-------------|
| `id` | `string` | ✅ | メッセージID（UUIDv4形式） | UUID形式、一意性保証 |
| `sessionId` | `string` | ✅ | 所属セッションID（外部キー） | 有効なSession IDを参照 |
| `role` | `"user" \| "assistant"` | ✅ | 発言者（ユーザーまたはAI） | "user" or "assistant"のみ |
| `content` | `string` | ✅ | メッセージ内容 | 1文字以上、100KB以下（FR-013） |
| `createdAt` | `number` | ✅ | 送信日時（Unix epoch秒） | 正の整数 |

**Validation Rules**:
- `content`: 不正な制御文字（NULL文字等）を含まない（FR-013）
- `content`: 最大サイズ100KB（102,400バイト）
- `role`: "user"または"assistant"のみ許可
- `sessionId`: 存在しないセッションIDの場合、404エラー（FR-012）

**Lifecycle**:
1. **作成**: POST /api/chat時にユーザーメッセージとAI応答メッセージを作成
2. **取得**: GET /api/chat/:sessionId/history時に時系列順で取得
3. **更新・削除**: Phase 2では未実装（Phase 3以降で検討）

**Relationships**:
- **Message N ←→ 1 Session**: 複数のMessageは1つのSessionに所属

---

### ChatHistory（チャット履歴スナップショット）

KVストレージに保存される会話履歴のスナップショット。LLMコンテキストとして使用されます。

**Properties**:

| フィールド | 型 | 必須 | 説明 | バリデーション |
|:---------|:---|:-----|:-----|:-------------|
| `sessionId` | `string` | ✅ | セッションID（KVキーの一部） | UUID形式 |
| `messages` | `Message[]` | ✅ | メッセージ配列（最大50件） | 0件以上、50件以下 |
| `lastUpdatedAt` | `number` | ✅ | 最終更新日時（Unix epoch秒） | 正の整数 |

**KV Storage Pattern**:
- **Key**: `chat:session:{sessionId}:messages`
- **Value**: JSON.stringify(ChatHistory)
- **TTL**: 永続化（expirationTtl未設定）
- **Window**: 最新50件のみ保持（FR-015）、古いメッセージは自動削除

**Lifecycle**:
1. **作成**: POST /api/chat（初回メッセージ）時にKVに空配列を作成
2. **更新**: メッセージ送信時に新しいメッセージをpush、50件を超えた場合は古いメッセージを削除
3. **読み込み**: POST /api/chat時にKVから読み込み、LLMコンテキストとして使用
4. **同期**: D1にベストエフォート型で同期（保存失敗時もKV保存成功なら200返却、Clarifications Q1参照）

---

## Phase 1との関係

### 既存エンティティ（Phase 1）

Phase 1で定義された以下のエンティティは継続して使用します：

#### Spec（仕様書）

**Phase 1のProperties**（変更なし）:

| フィールド | 型 | 必須 | 説明 |
|:---------|:---|:-----|:-----|
| `id` | `number` | ✅ | 仕様書ID（自動採番） |
| `requirements` | `string` | ✅ | 元の要件テキスト |
| `projectName` | `string \| null` | - | プロジェクト名 |
| `analysis` | `Analysis` | ✅ | AI分析結果 |
| `architecture` | `Architecture` | ✅ | アーキテクチャ提案 |
| `specDraft` | `string` | ✅ | 生成された仕様書 |
| `createdAt` | `number` | ✅ | 作成日時（Unix epoch秒） |

**Phase 2での拡張（任意）**:
- `sessionId` フィールドを追加（どのSessionから生成された仕様書かを記録）
- ただし、Phase 2の最小実装では必須ではない（Phase 3以降で検討）

#### Analysis（AI分析結果）

**Phase 1のProperties**（変更なし）:

| フィールド | 型 | 必須 | 説明 |
|:---------|:---|:-----|:-----|
| `summary` | `string` | ✅ | 要件全体の概要 |
| `keyPoints` | `string[]` | ✅ | 重要なポイント |
| `actors` | `string[]` | ✅ | 関係者（エンドユーザー、管理者等） |
| `mainFeatures` | `string[]` | ✅ | 主要機能 |

#### Architecture（アーキテクチャ提案）

**Phase 1のProperties**（変更なし）:

| フィールド | 型 | 必須 | 説明 |
|:---------|:---|:-----|:-----|
| `overview` | `string` | ✅ | アーキテクチャ全体の概要 |
| `components` | `Component[]` | ✅ | コンポーネント配列 |
| `dataFlow` | `string` | ✅ | データフロー説明 |
| `technologies` | `string[]` | ✅ | 使用技術スタック |

---

## D1 Database Schema

Phase 2で新規作成する`sessions`テーブルと`messages`テーブルのD1スキーマ定義です。

### Migration: 0002_create_sessions_messages.sql

```sql
-- sessionsテーブル
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- UUIDv4形式のセッションID
  created_at INTEGER NOT NULL,       -- Unix epoch秒
  updated_at INTEGER NOT NULL,       -- Unix epoch秒
  status TEXT NOT NULL DEFAULT 'active' -- active/archived/deleted
);

-- messagesテーブル
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- UUIDv4形式のメッセージID
  session_id TEXT NOT NULL,         -- 外部キー（sessionsテーブル）
  role TEXT NOT NULL,               -- "user" or "assistant"
  content TEXT NOT NULL,            -- メッセージ内容（最大100KB）
  created_at INTEGER NOT NULL,      -- Unix epoch秒
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
```

**インデックス戦略** (research.mdから):
- `idx_sessions_created_at`: セッション一覧の時系列表示（Phase 3以降）
- `idx_messages_session_id`: 特定セッションのメッセージ取得（Phase 2の会話履歴API）
- `idx_messages_session_created`: 複合インデックス（session_id + created_at）で時系列順メッセージ取得を最適化

---

## TypeScript Type Definitions

Phase 2で`src/types/entities.ts`に追加する型定義です。

```typescript
/**
 * セッション（会話の単位）
 */
export type Session = {
  id: string; // UUIDv4
  createdAt: number; // Unix epoch秒
  updatedAt: number; // Unix epoch秒
  status: 'active' | 'archived' | 'deleted'; // Phase 2では'active'のみ使用
};

/**
 * メッセージ（セッション内の個別発言）
 */
export type Message = {
  id: string; // UUIDv4
  sessionId: string; // 所属セッションID
  role: 'user' | 'assistant'; // 発言者
  content: string; // メッセージ内容（最大100KB）
  createdAt: number; // Unix epoch秒
};

/**
 * チャット履歴スナップショット（KVストレージ用）
 */
export type ChatHistory = {
  sessionId: string; // セッションID
  messages: Message[]; // メッセージ配列（最大50件）
  lastUpdatedAt: number; // 最終更新日時（Unix epoch秒）
};
```

**Phase 1からの継続** (`src/types/entities.ts`に既存):
```typescript
export type Spec = { /* ... */ };
export type Analysis = { /* ... */ };
export type Architecture = { /* ... */ };
```

---

## Data Flow

### 会話メッセージの送信フロー

```text
1. User → POST /api/chat { sessionId?, message }
   ↓
2. [新規の場合] Session作成（UUIDv4生成） → D1 sessionsテーブルに保存（ベストエフォート）
   ↓
3. KVからChatHistory読み込み（key: chat:session:{sessionId}:messages）
   ↓
4. Userメッセージを作成 → ChatHistory.messages.push()
   ↓
5. ChatHistoryをMastra Agent Memoryに渡してLLM応答生成（最新50件のみコンテキスト）
   ↓
6. Assistantメッセージを作成 → ChatHistory.messages.push()
   ↓
7. [50件超過時] ChatHistory.messages.shift()で古いメッセージ削除
   ↓
8. ChatHistoryをKVに保存（永続化、TTLなし）
   ↓
9. UserメッセージとAssistantメッセージをD1 messagesテーブルに保存（ベストエフォート）
   ↓
10. Session.updatedAtをD1で更新（ベストエフォート）
   ↓
11. User ← 200 { sessionId, response }（D1失敗時もKV成功なら200返却、Clarifications Q1）
```

### 会話履歴の取得フロー

```text
1. User → GET /api/chat/:sessionId/history
   ↓
2. KVからChatHistory読み込み（key: chat:session:{sessionId}:messages）
   ↓
3. [KV失敗時] D1 messagesテーブルからフォールバック読み込み（session_id, created_at順）
   ↓
4. User ← 200 { sessionId, messages: Message[] }（時系列順、FR-011）
```

---

## State Transitions

### Session Status

```text
[新規作成] → active
            ↓
         [Phase 4以降]
            ↓
         archived
            ↓
         deleted
```

Phase 2では`active`状態のみ使用。Phase 4以降でアーカイブ・削除機能を実装予定。

### Message Lifecycle

```text
[送信] → KV保存 → [成功] → D1保存（ベストエフォート）
                    ↓
                 [D1失敗時]
                    ↓
              ログ記録のみ、200返却
```

Phase 2ではメッセージの更新・削除は未実装。Phase 3以降で編集・削除機能を検討。

---

## Validation & Constraints

### Message Content Validation

```typescript
// src/middleware/message-validator.ts（新規作成想定）
export function validateMessageContent(content: string): { valid: boolean; error?: string } {
  // FR-013: 1文字以上
  if (content.length === 0) {
    return { valid: false, error: 'メッセージは1文字以上である必要があります' };
  }

  // FR-013: 100KB以下
  const sizeInBytes = new TextEncoder().encode(content).length;
  if (sizeInBytes > 100 * 1024) {
    return { valid: false, error: 'メッセージは100KB以下である必要があります' };
  }

  // FR-013: 不正な制御文字を含まない
  if (content.includes('\0')) {
    return { valid: false, error: 'メッセージに不正な制御文字が含まれています' };
  }

  return { valid: true };
}
```

### Session ID Validation

```typescript
// UUIDv4形式の検証
const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateSessionId(sessionId: string): boolean {
  return uuidv4Regex.test(sessionId);
}
```

---

## Performance Considerations

### KV Read/Write Optimization

- **Read**: `await c.env.DEV_ARCHITECT_SESSIONS.get(key, 'json')` → 5ms未満（research.mdから）
- **Write**: `await c.env.DEV_ARCHITECT_SESSIONS.put(key, JSON.stringify(value))` → 非同期、レイテンシ影響小
- **Window管理**: 50件ウィンドウで配列サイズを制限、JSON.parseパフォーマンスを最適化

### D1 Query Optimization

- **複合インデックス使用**: `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at` → `idx_messages_session_created`で高速化
- **LIMIT句**: 会話履歴取得時に`LIMIT 50`でKVウィンドウと整合性を保つ

### LLM Context Optimization

- **最新50件のみ**: FR-015により、Geminiのトークン制限とレスポンス時間を最適化
- **全履歴はD1に保存**: 会話履歴API経由で取得可能（SC-006: 200ms以内）

---

## Next Steps

1. **Repository実装**: `SessionRepository`と`MessageRepository`を作成（Phase 1の`SpecRepository`パターンを踏襲）
2. **Service実装**: `ChatHistoryService`を作成（KV読み書き、50件ウィンドウ管理）
3. **Mastra統合**: `chatConversation`ワークフローまたは`requirement-refiner` Agentを実装
4. **API実装**: `src/routes/chat.ts`を作成（POST /api/chat、GET /api/chat/:sessionId/history）
5. **UI実装**: `public/index.html`を簡易チャットUIに拡張

次のフェーズで`contracts/`（APIコントラクト）と`quickstart.md`（開発ガイド）を作成します。
