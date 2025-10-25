# Phase 2実装計画のための技術調査

**調査実施日**: 2025-10-25  
**調査対象**: Phase 2（対話フロー + セッション管理）の実装に必要な技術パターンとベストプラクティス  
**現在地**: Phase 1完了、Phase 2開始準備完了（PROGRESS.md参照）

---

## 1. Cloudflare KV for Chat History Storage

### Decision（採用パターン）

**KV単独アプローチ（Phase 2範囲）**

Phase 2の範囲では、KVストレージを会話履歴の一次ストレージとして使用し、D1をベストエフォート型バックアップとして活用する。

**KVストレージパターン**:
- **キー構造**: `chat:session:{sessionId}:messages`
- **値形式**: JSON配列（全メッセージを1つのキーに格納）
- **TTL戦略**: 永続化（TTL未設定、`expirationTtl`パラメータを指定しない）
- **メッセージ制限**: 50件ウィンドウ（最新50件のみLLMコンテキスト、全件はD1に保存）

### Rationale（選択理由）

1. **パフォーマンス**: Cloudflare KVは最近のリアーキテクチャで「p99読み込みレイテンシを200msから5ms未満に改善」しており、Phase 2の目標（会話履歴取得200ms以内）を達成可能
2. **シンプルさ**: Phase 2は小規模チーム向け（同時10セッション）のため、KVの「1秒1書き込み制限」は問題にならない
3. **Workers制約**: Durable Objectsは強い一貫性を提供するが、Phase 2の要件（楽観的並行制御、タイムスタンプ順序保証）ではKVで十分
4. **コスト効率**: KVは読み取りヘビーなワークロード（会話履歴参照）で最適化されており、Phase 1と同様のストレージ戦略を継続できる

### Alternatives Considered（検討した他の選択肢）

- **Durable Objects**: 強い一貫性と低レイテンシを提供するが、Phase 2の要件では過剰。Phase 3以降、複数ユーザーのコラボレーション機能が追加される場合に再検討。
- **個別キーパターン（`chat:session:{sessionId}:message:{messageId}`）**: メッセージごとにKVキーを作成する方法。1セッションあたり数十〜数百のKV読み込みが必要になり、レイテンシとコストが増大するため不採用。
- **D1単独**: D1のみで会話履歴を管理する方法。ただし、D1はKVより読み込みレイテンシが高い可能性があり、Phase 2の200ms目標を達成しにくいため、KVを一次ストレージとして使用。

---

## 2. Mastra Multi-turn Conversation Workflows

### Decision（採用パターン）

**Mastra Agent Memoryを使用したステートフル会話実装**

Mastraの`Memory`オブジェクトを使用し、`resource`（セッションID）と`thread`（会話スレッドID、Phase 2ではセッションIDと同一）で会話履歴を管理する。

**実装パターン**:
```typescript
import { Agent } from '@mastra/core';
import { Memory } from '@mastra/memory';

const memory = new Memory({
  storage: customKVAdapter, // KV統合用カスタムアダプタ
  options: {
    lastMessages: 50 // 最新50件をLLMコンテキストに含める（Phase 2要件）
  }
});

const requirementRefinerAgent = new Agent({
  name: 'requirement-refiner',
  model: geminiModel,
  instructions: '要件を対話的に精緻化するエージェント...',
  memory
});

const response = await requirementRefinerAgent.generate(userMessage, {
  memory: {
    resource: sessionId, // セッションID（安定した識別子）
    thread: sessionId    // スレッドID（Phase 2ではセッションIDと同一）
  }
});
```

### Rationale（選択理由）

1. **Mastra公式サポート**: Mastraは`Memory`オブジェクトで「マルチターン会話が過去のやり取りを参照する」機能を公式にサポート
2. **ストレージ抽象化**: カスタムアダプタを作成することで、KVストレージと統合可能
3. **コンテキスト管理**: `lastMessages: 50`で最新50件のみLLMコンテキストに含めることができ、Geminiのトークン制限とレスポンス時間を最適化
4. **会話文脈保持**: `resource`と`thread`で会話を分離し、複数セッションが混同されない

### Alternatives Considered（検討した他の選択肢）

- **手動で会話履歴をLLMプロンプトに組み込む**: Mastra Memoryを使わず、KVから履歴を読み込んで手動でプロンプトを構築する方法。実装コストが高く、Mastraのエコシステムとの統合が弱いため不採用。
- **Mastra Workflowの`.suspend()`機能**: ワークフローを一時停止してユーザー入力を待つ機能。Phase 2の要件（HTTPリクエスト単位で応答を返す）には適さないため、Agentベースのアプローチを採用。

---

## 3. D1 Session/Message Schema Design

### Decision（採用スキーマ）

**sessions/messagesテーブルを作成し、タイムスタンプはINTEGER（Unix epoch秒）で管理**

```sql
-- migrations/0002_create_sessions_messages.sql

-- sessionsテーブル
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- UUIDv4形式のセッションID
  created_at INTEGER NOT NULL,       -- Unix epoch秒
  updated_at INTEGER NOT NULL,       -- Unix epoch秒
  status TEXT NOT NULL DEFAULT 'active' -- active/archived/deleted（Phase 4以降で使用）
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

**インデックス戦略**:
- `idx_sessions_created_at`: セッション一覧の時系列表示（Phase 3以降）
- `idx_messages_session_id`: 特定セッションのメッセージ取得（Phase 2の会話履歴API）
- `idx_messages_session_created`: 複合インデックス（session_id + created_at）で時系列順メッセージ取得を最適化

### Rationale（選択理由）

1. **タイムスタンプ型選択（INTEGER）**: D1/SQLiteでは`CURRENT_TIMESTAMP`がテキスト型を返すため、Workers側で`Date.now()`（Unix epochミリ秒）または`Math.floor(Date.now() / 1000)`（秒）を使用してINTEGERで保存する方が型安全性が高い
2. **インデックス設計**: 複数列でフィルタリングする場合、複合インデックスを作成するベストプラクティスに従い、`(session_id, created_at)`複合インデックスを作成
3. **正規化**: sessionsとmessagesを分離することで、セッションメタデータ（作成日時、ステータス）とメッセージ履歴を独立して管理
4. **CASCADE削除**: セッション削除時にメッセージも自動削除（Phase 4以降のアーカイブ機能で使用）

### Alternatives Considered（検討した他の選択肢）

- **タイムスタンプをTEXT型で保存**: SQLiteの`CURRENT_TIMESTAMP`は`YYYY-MM-DD HH:MM:SS`形式のテキストを返すが、Workers側でJavaScript `Date`オブジェクトとの変換コストが発生するため、INTEGER型を採用
- **メッセージをJSON配列でsessionsテーブルに格納**: 正規化を放棄してメッセージをJSONカラムに保存する方法。ただし、メッセージ単位でのインデックス作成や検索が困難になるため不採用
- **タイムスタンプにミリ秒（`Date.now()`）を使用**: JavaScript標準のミリ秒形式。ただし、秒単位で十分であり、秒単位の方が人間にとって可読性が高いため、秒単位を採用

---

## 4. Static HTML Chat UI with localStorage

### Decision（採用パターン）

**Vanilla JavaScript + localStorageでセッションID管理、textContentでXSS対策**

**実装パターン**:
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Dev Architect - 要件対話</title>
  <style>
    /* 簡易チャットUI CSS */
    .message-user { text-align: right; background: #e3f2fd; }
    .message-assistant { text-align: left; background: #f5f5f5; }
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="messages"></div>
    <input id="input" type="text" placeholder="要件を入力...">
    <button id="send">送信</button>
  </div>

  <script>
    // localStorageからセッションID復元
    let sessionId = localStorage.getItem('dev-architect-session-id');

    // メッセージ送信
    document.getElementById('send').addEventListener('click', async () => {
      const input = document.getElementById('input');
      const message = input.value.trim();
      if (!message) return;

      // ローディング表示、送信ボタン無効化（FR-019）
      document.getElementById('send').disabled = true;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message })
        });

        if (!res.ok) {
          // エラーハンドリング（FR-020）
          const error = await res.json();
          alert(`エラー: ${error.message}`);
          return;
        }

        const data = await res.json();
        
        // セッションID保存（初回のみ）
        if (!sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('dev-architect-session-id', sessionId);
        }

        // メッセージ表示（XSS対策: textContent使用）
        displayMessage('user', message);
        displayMessage('assistant', data.response);

        input.value = '';
      } catch (err) {
        alert('通信エラーが発生しました');
      } finally {
        document.getElementById('send').disabled = false;
      }
    });

    // メッセージ表示関数（XSS対策: textContent使用）
    function displayMessage(role, content) {
      const div = document.createElement('div');
      div.className = `message-${role}`;
      div.textContent = content; // ← HTMLエスケープ（innerHTML使用禁止）
      document.getElementById('messages').appendChild(div);
    }

    // ページロード時に会話履歴復元（FR-017）
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

**XSS対策パターン**:
```javascript
// ❌ 危険: innerHTML使用（XSS脆弱性）
div.innerHTML = content;

// ✅ 安全: textContent使用（自動HTMLエスケープ）
div.textContent = content;
```

### Rationale（選択理由）

1. **textContentでXSS対策**: OWASP推奨パターン「innerHTML禁止、textContent使用」を採用。ユーザー入力やLLM応答を安全に表示
2. **localStorageでセッション管理**: ブラウザ標準API、シンプルな実装、Phase 2の要件（匿名セッション、認証なし）に最適
3. **Vanilla JavaScript**: フレームワーク依存なし、Cloudflare Pages静的ホスティングで即座にデプロイ可能
4. **レスポンシブ対応**: CSS Flexbox/Gridで基本的なレイアウト、スマートフォン対応（SC-009）

### Alternatives Considered（検討した他の選択肢）

- **React/Vue.js**: フレームワークを使用したチャットUI。Phase 2の「簡易UI」要件にはオーバーエンジニアリング。Phase 3以降で高度なUI機能が必要になった場合に再検討。
- **DOMPurifyライブラリ**: HTMLサニタイゼーションライブラリ。Phase 2では`textContent`で十分対応可能なため、外部依存を避けた。
- **sessionStorage**: タブごとに分離されるストレージ。Phase 2の要件（タブをまたいで会話を継続）には適さないため、localStorage採用。
- **Cookie**: サーバー側で自動送信される。Phase 2では認証なしの匿名セッションのため、クライアント側管理（localStorage）で十分。

---

## 5. Cloudflare Workers Rate Limiting & Concurrency

### Decision（採用パターン）

**Cloudflare Workers Rate Limiting API（GA）を使用したセッション単位のレート制限**

**実装パターン**:
```typescript
// wrangler.toml
[[rate_limit]]
binding = "CHAT_RATE_LIMIT"

// src/routes/chat.ts
export const chatRoute = async (c: Context) => {
  const { sessionId } = await c.req.json();

  // セッション単位でレート制限（1分間に10リクエスト）
  const { success } = await c.env.CHAT_RATE_LIMIT.limit({
    key: `session:${sessionId}`,
    rate: 10,
    period: 60
  });

  if (!success) {
    return c.json({ error: 'レート制限に達しました。しばらく待ってから再試行してください。' }, 429);
  }

  // 通常の処理
  // ...
};
```

**並行リクエスト処理パターン**:
- **楽観的並行制御**: Phase 2では競合検出なし、タイムスタンプ順序保証のみ（FR-004、spec.md Clarifications）
- **UI側での送信ボタン無効化**: FR-019により、メッセージ送信中は送信ボタンを無効化し、実質的な競合を防止
- **Workers並行実行**: Cloudflare Workers全体で同時実行数の制限なしのため、10セッション並行処理は問題なし

### Rationale（選択理由）

1. **Rate Limiting API（GA）**: 2025年9月にGAとなり、本番環境での使用が推奨される。Phase 2の小規模チーム要件（同時10セッション）に最適
2. **セッション単位のレート制限**: `key: session:{sessionId}`で各セッションを独立して制限。Phase 2の目標（同時10セッション、各セッション1分間に10リクエスト）を実現
3. **最終的整合性**: Rate Limiting APIは最終的整合性モデルを採用しており、厳密なレート制限が不要なPhase 2に適している
4. **低レイテンシ**: カウンターは同じWorkerが実行されるマシン上にキャッシュされ、同じCloudflareロケーション内のバッキングストアと非同期通信するため、レイテンシ増加なし

### Alternatives Considered（検討した他の選択肢）

- **Durable Objectsでレート制限**: 強い一貫性を提供するが、すべてのリクエストが依存する単一のDurable Objectはアンチパターンとの公式推奨があり、Phase 2の要件には過剰
- **KVでカウンター管理**: KVに`rate:session:{sessionId}`キーを作成してカウンター管理。ただし、KVは「1秒1書き込み制限」があり、高頻度のレート制限には不向き。Rate Limiting APIの方が最適化されている。
- **レート制限なし**: Phase 2の小規模チーム要件では必須ではないが、悪意のあるリクエストや誤操作による過負荷を防ぐため、軽量なRate Limiting APIを実装

---

## まとめ

### 採用技術スタック（Phase 2）

| コンポーネント | 採用技術 | 主な理由 |
|:---|:---|:---|
| 会話履歴一次ストレージ | Cloudflare KV（JSON配列、永続化） | 5ms未満の読み込みレイテンシ、Phase 2の200ms目標を達成 |
| 会話履歴永続化 | D1（sessions/messagesテーブル、INTEGER timestamp） | ベストエフォート型バックアップ、Phase 1パターン継続 |
| マルチターン会話 | Mastra Agent Memory（lastMessages: 50） | 公式サポート、ストレージ抽象化、コンテキスト管理 |
| チャットUI | Vanilla JavaScript + localStorage + textContent | シンプル、XSS対策、Cloudflare Pages即座デプロイ |
| レート制限 | Cloudflare Workers Rate Limiting API（GA） | セッション単位制限、低レイテンシ、最終的整合性 |

### 次のステップ

1. **Phase 1設計**: `data-model.md`（スキーマ設計）、`quickstart.md`（開発ガイド）、`contracts/`（APIコントラクト）を作成
2. **Phase 2実装**: `/speckit.tasks`コマンドで`tasks.md`を生成し、TDD（Red → Green → Refactor）で実装開始
