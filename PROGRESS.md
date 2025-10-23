# 📋 Dev Architect 開発進捗管理

**最終更新**: 2025-10-24

---

## 🎯 現在地

**Phase 1: Mastra統合とワークフロー骨格構築** を進行中

**現在作業**: Phase 1-4（/api/specエンドポイント実装）← 今ココ

進捗: **50%** (3/6タスク完了)

---

## Phase 1: Mastra統合とワークフロー骨格構築

**目的**: Mastraを導入し、AIエージェントとして仕様書生成の最小フローを確立する

| ステータス | タスク | 詳細 | 備考 |
|:---:|:---|:---|:---|
| ✅ | Phase 1-1 | mastraとその依存を追加 | `pnpm add mastra @mastra/core @ai-sdk/google zod` 完了 |
| ✅ | Phase 1-2 | mastra.config.ts作成 | Gemini 2.5 Flash設定完了 |
| ✅ | Phase 1-3 | generateSpecワークフロー作成 | Mastra公式構造に従い`src/mastra/`配下に実装完了 |
| 🚧 | Phase 1-4 | /api/specエンドポイント実装 | **← 今ココ** Hono上にAPIルート作成 |
| ⏳ | Phase 1-5 | KV/D1バインディング統合 | session仮保存、結果永続化、スキーマ作成 |
| ⏳ | Phase 1-6 | 動作確認テスト | curl/wrangler dev経由でPOST→仕様書草稿確認 |

### Phase 1 完了条件

- [ ] `/api/spec` にJSONで要件を投げると、LLMが構成と仕様書草稿を返す
- [ ] D1に`spec`レコードが1件保存される
- [ ] 開発環境でMastraが正常稼働

### Phase 1 成果物

```
src/
 ├── index.ts                      # Honoエントリーポイント
 ├── mastra/                       # Mastraアプリケーション
 │   ├── index.ts                  # Mastraインスタンス
 │   └── workflows/
 │       └── generateSpec.ts       # 仕様書生成ワークフロー
 └── routes/
     └── spec.ts                   # /api/spec エンドポイント
mastra.config.ts                   # （削除予定、src/mastra/index.tsに統合済み）
```

---

## Phase 2: 対話フロー + セッション管理

**目的**: ユーザーとのマルチターン会話を実現し、要件を対話的に精緻化できるようにする

| ステータス | タスク | 詳細 |
|:---:|:---|:---|
| ⬜ | Phase 2-1 | /api/chat API設計 | POST、KVにsession_id単位で履歴保存 |
| ⬜ | Phase 2-2 | フロー拡張 | generateSpec分割、stateful化 |
| ⬜ | Phase 2-3 | UI試作 | Cloudflare Pagesで簡易チャットUI（React/Vite） |
| ⬜ | Phase 2-4 | DB連携 | D1にsessions/specs/messagesテーブル拡張 |
| ⬜ | Phase 2-5 | セッション復元 | KV→D1同期、チャット再開時に履歴再現 |

### Phase 2 完了条件

- [ ] Web UI or curlで要件を会話的に入力できる
- [ ] KVに履歴が残り、D1に統合記録される
- [ ] Mastraが会話文脈を保持して仕様書を更新できる

### Phase 2 成果物

```
src/
 ├── routes/chat.ts
 ├── workflows/
 │    ├── analyzeRequirements.ts
 │    ├── refineConstraints.ts
 │    └── generateSpec.ts
 └── utils/sessionStore.ts
```

---

## Phase 3: PDF／資料連携

**目的**: PDFや既存仕様書を取り込み、内容を解析して仕様生成に反映する

| ステータス | タスク | 詳細 |
|:---:|:---|:---|
| ⬜ | Phase 3-1 | R2連携 | PDFアップロード→R2保存→署名URL発行 |
| ⬜ | Phase 3-2 | 抽出処理 | /api/uploadエンドポイント、PDF→テキスト抽出 |
| ⬜ | Phase 3-3 | Mastra統合 | generateSpec入力にPDF抽出テキスト組み込み |
| ⬜ | Phase 3-4 | D1登録 | documentsテーブル、仕様書レコードと紐付け |
| ⬜ | Phase 3-5 | 確認UI | アップロード済み資料一覧/再利用 |

### Phase 3 完了条件

- [ ] PDFアップロード→テキスト抽出→仕様生成まで自動化
- [ ] R2とD1でファイルと仕様書の紐付けが確認できる
- [ ] API層が一貫して動作

### Phase 3 成果物

```
src/
 ├── routes/upload.ts
 ├── services/pdfParser.ts
 └── workflows/generateSpec.ts（PDF対応版）
```

---

## 📈 全体進捗サマリー

| Phase | 名称 | 進捗 | 主要技術 | 完了目標 |
|:---:|:---|:---:|:---|:---|
| 1 | Mastra統合と骨格 | 🚧 33% | Mastra / Hono / D1 | `/api/spec`で仕様書生成 |
| 2 | 対話フロー | ⬜ 0% | KV / Hono / Pages | 要件→仕様更新チャット |
| 3 | PDF連携 | ⬜ 0% | R2 / Mastra | PDF→仕様書生成 |

**総合進捗**: 🚧 11% (2/18タスク完了)

---

## 📝 メモ・課題

- zod v4.1.12とai SDKのpeer dependency警告あり（動作には影響なし）
- Gemini APIキーは環境変数`GOOGLE_GENERATIVE_AI_API_KEY`から取得する設定
- wrangler.tomlが空の状態 → バインディング設定が必要
- TypeScript型チェック: ✅ エラーなし（npx tsc --noEmit）

---

## 🔄 更新履歴

- 2025-10-24: Phase 1開始、1-1完了（mastra/@ai-sdk/google導入）
- 2025-10-24: 1-2完了（Gemini 2.5 Flash設定）
- 2025-10-24: 1-3完了（Mastra公式構造でワークフロー実装）、1-4着手
