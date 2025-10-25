# Quickstart: Phase 2 対話フロー + セッション管理

**Feature**: Phase 2 - 対話フロー + セッション管理  
**Created**: 2025-10-25  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## 概要

Phase 2では、ユーザーとAIのマルチターン会話を実現し、要件を対話的に精緻化する機能を実装します。このガイドでは、ローカル開発環境のセットアップから実装、テスト、デプロイまでの手順を説明します。

**Phase 2の主要機能**:
- `/api/chat`エンドポイント（POST）でマルチターン会話
- KVストレージで会話履歴を高速保存（<200msレスポンス目標）
- D1データベースでベストエフォート型永続化
- 簡易チャットUI（Vanilla JavaScript + localStorage）

---

## Prerequisites（前提条件）

### Phase 1が完了していること

以下のPhase 1コンポーネントが正常に動作している必要があります：

- ✅ Cloudflare Workers開発環境（`pnpm run dev`で起動）
- ✅ D1データベース（`dev_architect_db`、specsテーブル存在）
- ✅ `/api/spec`エンドポイント（Phase 1仕様書生成）
- ✅ Mastra + Gemini 2.5 Flash統合

### 必要なツール

- Node.js 18+
- pnpm
- Wrangler CLI（Cloudflare Workers開発ツール）
- Git

---

## Step 1: D1マイグレーション実行

Phase 2で必要な`sessions`テーブルと`messages`テーブルを作成します。

### 1.1 マイグレーションファイル作成

```bash
# migrations/0002_create_sessions_messages.sql を作成
cat <<'EOF' > migrations/0002_create_sessions_messages.sql
-- sessionsテーブル
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

-- messagesテーブル
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_session_created ON messages(session_id, created_at);
EOF
```

### 1.2 ローカルD1にマイグレーション適用

```bash
# ローカル開発環境にマイグレーション適用
pnpm wrangler d1 migrations apply dev_architect_db --local

# テーブル作成確認
pnpm wrangler d1 execute dev_architect_db --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# 期待される出力:
# sessions
# messages
# specs（Phase 1で作成済み）
```

### 1.3 本番D1にマイグレーション適用（デプロイ時）

```bash
# 本番環境にマイグレーション適用（Phase 2実装完了後）
pnpm wrangler d1 migrations apply dev_architect_db --remote
```

---

## Step 2: KVネームスペース設定

Phase 2では`DEV_ARCHITECT_SESSIONS`という名前のKVネームスペースを使用します。

### 2.1 KVネームスペース作成

```bash
# ローカル開発用（wrangler devで自動作成されるため不要な場合あり）
# 本番環境用KVネームスペース作成
pnpm wrangler kv:namespace create "DEV_ARCHITECT_SESSIONS"

# 出力例:
# ✅ Successfully created KV namespace
#   id = "abcd1234efgh5678"
```

### 2.2 wrangler.toml更新

```toml
# wrangler.toml

name = "dev-architect"
main = "src/index.ts"
compatibility_date = "2025-10-01"

# KVバインディング追加
[[kv_namespaces]]
binding = "DEV_ARCHITECT_SESSIONS"
id = "abcd1234efgh5678"  # 上記コマンドで取得したID
preview_id = "preview-id" # プレビュー用（オプション）

# D1バインディング（Phase 1で設定済み）
[[d1_databases]]
binding = "dev_architect_db"
database_name = "dev_architect_db"
database_id = "your-database-id"

# Rate Limiting（Phase 2で追加）
[[rate_limit]]
binding = "CHAT_RATE_LIMIT"
```

---

## Step 3: 型定義追加

Phase 2の新しいエンティティ型を追加します。

### 3.1 src/types/entities.ts更新

```typescript
// src/types/entities.ts

// Phase 1の既存型（変更なし）
export type Spec = { /* ... */ };
export type Analysis = { /* ... */ };
export type Architecture = { /* ... */ };

// Phase 2の新規型
/**
 * セッション（会話の単位）
 */
export type Session = {
  id: string; // UUIDv4
  createdAt: number; // Unix epoch秒
  updatedAt: number; // Unix epoch秒
  status: 'active' | 'archived' | 'deleted';
};

/**
 * メッセージ（セッション内の個別発言）
 */
export type Message = {
  id: string; // UUIDv4
  sessionId: string;
  role: 'user' | 'assistant';
  content: string; // 最大100KB
  createdAt: number; // Unix epoch秒
};

/**
 * チャット履歴スナップショット（KVストレージ用）
 */
export type ChatHistory = {
  sessionId: string;
  messages: Message[]; // 最大50件
  lastUpdatedAt: number;
};
```

### 3.2 型チェック

```bash
# TypeScript型チェック
pnpm run typecheck

# 期待される出力: エラーなし
```

---

## Step 4: Repository実装（TDD）

Constitution原則II「テスト駆動開発」に従い、テストファーストで実装します。

### 4.1 SessionRepository テスト作成

```typescript
// tests/unit/repositories/session-repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionRepository } from '../../../src/repositories/session-repository';

describe('SessionRepository', () => {
  let repository: SessionRepository;
  let mockD1: D1Database;

  beforeEach(() => {
    // モックD1データベース作成
    mockD1 = {
      prepare: vi.fn(),
      // ...
    } as unknown as D1Database;
    repository = new SessionRepository(mockD1);
  });

  it('should create a new session', async () => {
    const sessionId = 'test-session-id';
    const createdAt = Math.floor(Date.now() / 1000);
    
    await repository.create({ id: sessionId, createdAt, updatedAt: createdAt, status: 'active' });
    
    // D1 INSERTクエリが呼ばれたことを確認
    expect(mockD1.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions')
    );
  });

  // 他のテストケース...
});
```

### 4.2 SessionRepository 実装

```typescript
// src/repositories/session-repository.ts
import { Session } from '../types/entities';

export class SessionRepository {
  constructor(private db: D1Database) {}

  async create(session: Session): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO sessions (id, created_at, updated_at, status)
        VALUES (?, ?, ?, ?)
      `)
      .bind(session.id, session.createdAt, session.updatedAt, session.status)
      .run();
  }

  async findById(id: string): Promise<Session | null> {
    const result = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(id)
      .first<{
        id: string;
        created_at: number;
        updated_at: number;
        status: string;
      }>();

    if (!result) return null;

    return {
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      status: result.status as 'active' | 'archived' | 'deleted',
    };
  }

  async updateUpdatedAt(id: string, updatedAt: number): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
      .bind(updatedAt, id)
      .run();
  }
}
```

### 4.3 MessageRepository 実装（同様のTDDパターン）

```typescript
// src/repositories/message-repository.ts
import { Message } from '../types/entities';

export class MessageRepository {
  constructor(private db: D1Database) {}

  async create(message: Message): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(message.id, message.sessionId, message.role, message.content, message.createdAt)
      .run();
  }

  async findBySessionId(sessionId: string): Promise<Message[]> {
    const results = await this.db
      .prepare(`
        SELECT * FROM messages 
        WHERE session_id = ? 
        ORDER BY created_at ASC
      `)
      .bind(sessionId)
      .all<{
        id: string;
        session_id: string;
        role: string;
        content: string;
        created_at: number;
      }>();

    return results.results.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: row.created_at,
    }));
  }
}
```

---

## Step 5: ChatHistoryService実装

KVストレージとの統合を行うサービス層を実装します。

### 5.1 ChatHistoryService実装

```typescript
// src/services/chat-history.ts
import { ChatHistory, Message } from '../types/entities';

export class ChatHistoryService {
  constructor(private kv: KVNamespace) {}

  private getKey(sessionId: string): string {
    return `chat:session:${sessionId}:messages`;
  }

  async load(sessionId: string): Promise<ChatHistory> {
    const key = this.getKey(sessionId);
    const data = await this.kv.get<ChatHistory>(key, 'json');

    if (!data) {
      // 新規セッション: 空の履歴を返す
      return {
        sessionId,
        messages: [],
        lastUpdatedAt: Math.floor(Date.now() / 1000),
      };
    }

    return data;
  }

  async save(history: ChatHistory): Promise<void> {
    const key = this.getKey(history.sessionId);
    
    // 50件ウィンドウ: 最新50件のみ保持（FR-015）
    if (history.messages.length > 50) {
      history.messages = history.messages.slice(-50);
    }

    history.lastUpdatedAt = Math.floor(Date.now() / 1000);
    
    await this.kv.put(key, JSON.stringify(history));
  }
}
```

---

## Step 6: Mastra Agent実装

Mastra Agent Memoryを使用した会話エージェントを実装します。

### 6.1 requirement-refiner Agent作成

```typescript
// src/mastra/agents/requirement-refiner.ts
import { Agent } from '@mastra/core';
import { gemini15Flash } from '@mastra/google';

export const requirementRefinerAgent = new Agent({
  name: 'requirement-refiner',
  model: gemini15Flash(),
  instructions: `あなたは経験豊富なエンジニアリングマネージャーです。
ユーザーから要件をヒアリングし、対話的に要件を精緻化してください。

**役割**:
- ユーザーの要件を理解し、不明瞭な点を質問する
- 段階的に詳細化を進める
- エッジケース、非機能要件、技術的制約を確認する
- 十分な情報が集まったら仕様書生成を提案する

**質問例**:
- 「〇〇の場合、どのような挙動を期待しますか？」
- 「パフォーマンス要件はありますか？（例: 〇秒以内の応答）」
- 「この機能はどのユーザーが使用しますか？」

**回答形式**:
- 簡潔で具体的な質問をする
- 一度に3〜5個程度の質問に絞る
- ユーザーが回答しやすいように選択肢を提示することもある

日本語で応答してください。`,
});
```

---

## Step 7: /api/chat ルート実装

### 7.1 chat.ts ルート作成

```typescript
// src/routes/chat.ts
import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../repositories/session-repository';
import { MessageRepository } from '../repositories/message-repository';
import { ChatHistoryService } from '../services/chat-history';
import { requirementRefinerAgent } from '../mastra/agents/requirement-refiner';
import { logInfo, logError } from '../utils/logger';

type Bindings = {
  dev_architect_db: D1Database;
  DEV_ARCHITECT_SESSIONS: KVNamespace;
  CHAT_RATE_LIMIT: RateLimit;
};

const chat = new Hono<{ Bindings: Bindings }>();

chat.post('/', async (c) => {
  const { sessionId: inputSessionId, message } = await c.req.json<{
    sessionId?: string;
    message: string;
  }>();

  // FR-013: メッセージバリデーション
  if (!message || message.trim().length === 0) {
    return c.json({ error: 'message is required' }, 400);
  }

  const sizeInBytes = new TextEncoder().encode(message).length;
  if (sizeInBytes > 100 * 1024) {
    return c.json({ error: 'message too large', details: 'メッセージは100KB以下である必要があります' }, 400);
  }

  if (message.includes('\0')) {
    return c.json({ error: 'invalid content', details: 'メッセージに不正な制御文字が含まれています' }, 400);
  }

  // セッションID生成または検証
  const sessionId = inputSessionId || uuidv4();
  const now = Math.floor(Date.now() / 1000);

  // Rate Limiting（セッション単位）
  const { success } = await c.env.CHAT_RATE_LIMIT.limit({ key: `session:${sessionId}`, rate: 10, period: 60 });
  if (!success) {
    return c.json({ error: 'rate limit exceeded', details: 'レート制限に達しました。' }, 429);
  }

  // KVから会話履歴読み込み
  const chatHistoryService = new ChatHistoryService(c.env.DEV_ARCHITECT_SESSIONS);
  let history;
  try {
    history = await chatHistoryService.load(sessionId);
  } catch (err) {
    logError('Failed to load chat history from KV', err);
    return c.json({ error: 'service unavailable', details: '会話履歴の読み込みに失敗しました。' }, 503);
  }

  // ユーザーメッセージ追加
  const userMessage = {
    id: uuidv4(),
    sessionId,
    role: 'user' as const,
    content: message,
    createdAt: now,
  };
  history.messages.push(userMessage);

  // Mastra Agent実行（会話履歴をコンテキストに含める）
  const conversationContext = history.messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
  const aiResponse = await requirementRefinerAgent.generate(conversationContext);

  // AI応答メッセージ追加
  const assistantMessage = {
    id: uuidv4(),
    sessionId,
    role: 'assistant' as const,
    content: aiResponse.text,
    createdAt: Math.floor(Date.now() / 1000),
  };
  history.messages.push(assistantMessage);

  // KVに保存
  await chatHistoryService.save(history);

  // D1に保存（ベストエフォート型、Clarifications Q1）
  try {
    const sessionRepo = new SessionRepository(c.env.dev_architect_db);
    const messageRepo = new MessageRepository(c.env.dev_architect_db);

    if (!inputSessionId) {
      // 新規セッション作成
      await sessionRepo.create({ id: sessionId, createdAt: now, updatedAt: now, status: 'active' });
    } else {
      // 既存セッション更新
      await sessionRepo.updateUpdatedAt(sessionId, now);
    }

    await messageRepo.create(userMessage);
    await messageRepo.create(assistantMessage);

    logInfo('Messages saved to D1 successfully');
  } catch (dbError) {
    logError('Failed to save messages to D1', dbError);
    // D1保存失敗でもKV成功なら200返却（ベストエフォート型）
  }

  return c.json({ sessionId, response: aiResponse.text });
});

chat.get('/:sessionId/history', async (c) => {
  const sessionId = c.req.param('sessionId');

  // KVから会話履歴取得
  const chatHistoryService = new ChatHistoryService(c.env.DEV_ARCHITECT_SESSIONS);
  let history;
  try {
    history = await chatHistoryService.load(sessionId);
  } catch (err) {
    logError('Failed to load chat history from KV', err);
    
    // KV失敗時はD1からフォールバック
    try {
      const messageRepo = new MessageRepository(c.env.dev_architect_db);
      const messages = await messageRepo.findBySessionId(sessionId);
      return c.json({ sessionId, messages });
    } catch (dbError) {
      logError('Failed to load chat history from D1', dbError);
      return c.json({ error: 'service unavailable' }, 503);
    }
  }

  return c.json({ sessionId, messages: history.messages });
});

export default chat;
```

### 7.2 index.tsにルート追加

```typescript
// src/index.ts
import { Hono } from 'hono';
import spec from './routes/spec';
import chat from './routes/chat'; // Phase 2追加

const app = new Hono();

// Phase 1（後方互換性）
app.route('/api/spec', spec);

// Phase 2
app.route('/api/chat', chat);

export default app;
```

---

## Step 8: 簡易チャットUI実装

### 8.1 public/index.html更新

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dev Architect - 要件対話</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    #messages { height: 400px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; }
    .message-user { text-align: right; background: #e3f2fd; padding: 8px; margin: 5px 0; border-radius: 8px; }
    .message-assistant { text-align: left; background: #f5f5f5; padding: 8px; margin: 5px 0; border-radius: 8px; }
    #input { width: 80%; padding: 10px; }
    #send { padding: 10px 20px; }
    #send:disabled { opacity: 0.5; }
  </style>
</head>
<body>
  <h1>Dev Architect - 要件対話</h1>
  <div id="messages"></div>
  <input id="input" type="text" placeholder="要件を入力..." />
  <button id="send">送信</button>

  <script>
    let sessionId = localStorage.getItem('dev-architect-session-id');

    document.getElementById('send').addEventListener('click', sendMessage);
    document.getElementById('input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    async function sendMessage() {
      const input = document.getElementById('input');
      const message = input.value.trim();
      if (!message) return;

      document.getElementById('send').disabled = true;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message })
        });

        if (!res.ok) {
          const error = await res.json();
          alert(`エラー: ${error.details || error.error}`);
          return;
        }

        const data = await res.json();
        
        if (!sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('dev-architect-session-id', sessionId);
        }

        displayMessage('user', message);
        displayMessage('assistant', data.response);

        input.value = '';
      } catch (err) {
        alert('通信エラーが発生しました');
      } finally {
        document.getElementById('send').disabled = false;
      }
    }

    function displayMessage(role, content) {
      const div = document.createElement('div');
      div.className = `message-${role}`;
      div.textContent = content; // XSS対策: textContent使用
      document.getElementById('messages').appendChild(div);
      document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
    }

    // ページロード時に会話履歴復元
    if (sessionId) {
      fetch(`/api/chat/${sessionId}/history`)
        .then(res => res.json())
        .then(data => {
          data.messages.forEach(msg => displayMessage(msg.role, msg.content));
        });
    }
  </script>
</body>
</html>
```

---

## Step 9: ローカル開発サーバー起動

### 9.1 開発サーバー起動

```bash
pnpm run dev

# 期待される出力:
# ⎔ Starting local server...
# [wrangler:inf] Ready on http://localhost:8787
```

### 9.2 手動テスト（curl）

```bash
# 新規セッション作成
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ECサイトのカート機能を実装したいです"}'

# 出力例:
# {
#   "sessionId": "550e8400-e29b-41d4-a716-446655440000",
#   "response": "カート機能について詳しく教えてください..."
# }

# 既存セッション継続
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "550e8400-e29b-41d4-a716-446655440000", "message": "はい、在庫管理も必要です"}'

# 会話履歴取得
curl http://localhost:8787/api/chat/550e8400-e29b-41d4-a716-446655440000/history
```

### 9.3 ブラウザテスト

1. http://localhost:8787 にアクセス
2. メッセージ入力欄に「ECサイトのカート機能を実装したいです」と入力
3. 送信ボタンをクリック
4. AI応答が表示されることを確認
5. 追加メッセージを送信し、会話履歴が保持されることを確認

---

## Step 10: デプロイ

### 10.1 本番環境デプロイ

```bash
# D1マイグレーション適用（本番）
pnpm wrangler d1 migrations apply dev_architect_db --remote

# Workersデプロイ
pnpm run deploy

# 期待される出力:
# ✅ Successfully published dev-architect
#    https://dev-architect.your-subdomain.workers.dev
```

### 10.2 本番環境動作確認

```bash
# 本番環境でテスト
curl -X POST https://dev-architect.your-subdomain.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "テストメッセージ"}'
```

---

## Troubleshooting（トラブルシューティング）

### KV読み込みエラー

**症状**: `503 Service Unavailable`, "会話履歴の読み込みに失敗しました"

**原因**: KVネームスペースが未作成、またはwrangler.tomlのバインディング設定誤り

**解決方法**:
1. `pnpm wrangler kv:namespace create "DEV_ARCHITECT_SESSIONS"`でKV作成
2. wrangler.tomlの`[[kv_namespaces]]`セクション確認
3. `pnpm run dev`再起動

### D1マイグレーションエラー

**症状**: `table already exists`

**原因**: マイグレーションが既に適用済み

**解決方法**:
```bash
# マイグレーション履歴確認
pnpm wrangler d1 migrations list dev_architect_db --local

# 強制再作成（注意: データ削除）
rm -rf .wrangler/state/v3/d1
pnpm wrangler d1 migrations apply dev_architect_db --local
```

### Mastra Agent応答なし

**症状**: AI応答が空文字列、またはタイムアウト

**原因**: Gemini APIキー未設定、またはネットワークエラー

**解決方法**:
1. `.dev.vars`に`GEMINI_API_KEY`設定確認
2. Mastra logs確認: `console.log(aiResponse)`
3. タイムアウト設定を60秒に延長（middleware/timeout.ts）

---

## Next Steps

Phase 2実装完了後、以下のステップに進みます：

1. **`/speckit.tasks`実行**: `tasks.md`を生成し、詳細なタスクリストを作成
2. **テスト拡張**: integration tests、contract testsを追加
3. **PROGRESS.md更新**: Phase 2完了をマーク、Phase 3計画を確認
4. **Phase 3準備**: 仕様書バージョン管理、UI高度化を計画

---

## 関連ドキュメント

- [spec.md](./spec.md) - Phase 2仕様書
- [plan.md](./plan.md) - Phase 2実装計画
- [data-model.md](./data-model.md) - データモデル設計
- [contracts/chat-api.yaml](./contracts/chat-api.yaml) - API契約
- [research.md](./research.md) - 技術調査レポート
