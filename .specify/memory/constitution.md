<!--
  SYNC IMPACT REPORT
  ==================
  Version Change: 1.1.0 → 1.2.0
  
  Changes (v1.2.0):
  - 新原則VIII「コミット管理 (Commit Management)」を追加
  - Conventional Commitsに準拠したコミットメッセージ規則を義務化
  - Claude Codeは変更ごとにコミットメッセージを提示（実行はユーザー）
  
  Changes (v1.1.0):
  - 新原則VII「進捗管理と可視化 (Progress Tracking and Visibility)」を追加
  - Claude CodeはPROGRESS.mdを常に参照・更新することを義務化
  - 開発ワークフローに進捗管理ステップを追加
  
  Previous Changes (v1.0.1):
  - パフォーマンス目標を緩和（初回応答: 500ms→3秒、対話応答: 2秒→5秒、仕様書生成: 5分→10分）
  - スケール目標を小規模チーム向けに調整（同時接続: 100+→10人、日次生成: 50+→10件）
  - 会話履歴保持をセッション制限から全履歴カバーに変更（コンテキストエンジニアリング前提）
  
  Previous Changes (v1.0.0):
  - Initial constitution creation for Dev Architect project
  - Added 6 core principles covering Japanese documentation, TDD, interactive requirements,
    tech stack, specification quality, and deployment architecture
  
  Templates Requiring Updates:
  ✅ plan-template.md - Constitution Check section aligns with principles
  ✅ spec-template.md - User scenario format supports interactive requirements gathering
  ✅ tasks-template.md - Test-first approach aligns with TDD principle
  ⚠️ CLAUDE.md - Needs PROGRESS.md reference update
  ⚠️ README.md - Should reference PROGRESS.md for development workflow
  
  Follow-up TODOs:
  - Update CLAUDE.md to include PROGRESS.md reference requirement
  - Consider adding PROGRESS.md reference to README.md for developers
-->

# Dev Architect Constitution

## Core Principles

### I. 日本語ドキュメンテーション (Japanese Documentation) - NON-NEGOTIABLE

すべてのドキュメント、仕様書、設計書は日本語で作成しなければならない。

- 仕様書（spec.md）は日本語で記述すること
- 設計ドキュメント（plan.md, data-model.md）は日本語で記述すること
- タスクリスト（tasks.md）は日本語で記述すること
- コード内のコメントは日本語で記述すること
- ユーザー向けドキュメント（README.md, quickstart.md）は日本語で記述すること

**根拠**: このプロジェクトの主な利用者は日本のAIスタートアップのエンジニアリングマネージャーであり、
要件整理と仕様書作成の効率化が目的である。母国語でのコミュニケーションにより、誤解を防ぎ、
より正確な要件定義と仕様書作成が可能となる。

### II. テスト駆動開発 (Test-Driven Development) - NON-NEGOTIABLE

すべての機能開発はTDDサイクルに従わなければならない。

- テストを先に書くこと（Test First）
- テストが失敗することを確認すること（Red）
- 実装してテストを通すこと（Green）
- リファクタリングすること（Refactor）
- 実装前にテストが存在しない場合、実装を開始してはならない

**根拠**: 要件定義支援エージェントとして、生成する仕様書の品質が重要である。
TDDにより、要件の漏れや矛盾を早期に発見し、高品質な仕様書を生成できる。
また、エージェント自体の動作保証にも不可欠である。

### III. 対話型要件整理 (Interactive Requirements Gathering)

エージェントはユーザーと対話的にやり取りし、要件を段階的に明確化しなければならない。

- チャットベースで要件をヒアリングすること
- 不明瞭な点は必ず質問して確認すること
- 要件の抜け漏れを防ぐため、体系的な質問フローを持つこと
- ユーザーの回答を構造化し、仕様書に反映すること
- 将来的には音声入力にも対応できる設計とすること

**根拠**: プロジェクトの成功基準は「アーキテクチャ設計や仕様書作成に必要十分な情報を
インタラクティブに聞き出し、ほとんど手直しの必要のないモノを提出できる」ことである。
対話的アプローチにより、重要な情報の見落としを防ぎ、高品質な成果物を生成できる。

### IV. 技術スタック標準 (Technology Stack Standards)

プロジェクトで使用する技術スタックは以下に統一しなければならない。

- **エージェントフレームワーク**: Mastra
- **デプロイメント**: Cloudflare Workers
- **Webフレームワーク**: Hono
- 新しい技術の導入は、既存スタックとの整合性を評価した上で判断すること

**根拠**: 技術スタックを統一することで、開発効率の向上、デプロイの簡素化、
メンテナンスコストの削減を実現する。Cloudflareでのデプロイを前提とすることで、
スケーラビリティとパフォーマンスを確保する。

### V. 仕様書品質保証 (Specification Quality Assurance)

生成する仕様書は、最小限の手直しで使用可能な品質でなければならない。

- システムアーキテクチャは、技術的に実現可能で矛盾のないものであること
- UI/UX設計は、ユーザーストーリーと整合性が取れていること
- 要件は具体的で、測定可能な形で記述されていること
- エッジケースや制約条件が適切に文書化されていること
- 対話的なフィードバックループにより、継続的に品質を改善すること

**根拠**: プロジェクトの失敗条件は「対話的に話を整理する中で、重要な情報を見落とし、
大量の手直しが必要な成果物を提出してしまう」ことである。高品質な仕様書を生成することで、
下流工程での手戻りを最小化し、開発効率を最大化する。

### VI. Cloudflareアーキテクチャ (Cloudflare Architecture)

Cloudflare Workersの特性を活かしたアーキテクチャ設計を行わなければならない。

- エッジコンピューティングの利点を活用すること
- Cloudflare Workersの制約（実行時間、メモリ、Cold Start等）を考慮すること
- Honoフレームワークのベストプラクティスに従うこと
- Cloudflare Bindingsを適切に使用すること（KV, Durable Objects, R2等）
- スケーラビリティとパフォーマンスを設計段階から考慮すること

**根拠**: Cloudflare Workersでのデプロイを前提とすることで、グローバルな低レイテンシー、
高可用性、コスト効率の良いインフラを実現する。アーキテクチャ設計段階から
プラットフォームの特性を理解し活用することが重要である。

### VII. 進捗管理と可視化 (Progress Tracking and Visibility)

開発作業は常に進捗状況を可視化し、計画的に進めなければならない。

- **PROGRESS.md**: プロジェクト全体の進め方、現在の位置、計画を記載した
  マスター進捗管理ファイルを維持すること
- **常時参照**: Claude Codeは作業開始時、タスク切り替え時、完了時に
  PROGRESS.mdを参照し、現在地を把握すること
- **常時更新**: タスク完了時、フェーズ移行時、計画変更時にPROGRESS.mdを
  即座に更新すること
- **チェックボックス管理**: 完了したタスクは✅、進行中は🚧、未着手は⏳で明示すること
- **進捗率の明示**: 各フェーズの進捗率（X%）を計算し、表示すること

**根拠**: 複数フェーズにわたる開発では、現在地の把握と計画との照合が不可欠である。
PROGRESS.mdを単一の信頼できる情報源（Single Source of Truth）とすることで、
作業の重複や見落としを防ぎ、計画的な開発を実現する。Claude Codeがこのファイルを
常に参照・更新することで、ユーザーは開発状況を常に把握できる。

### VIII. コミット管理 (Commit Management)

すべてのコード変更は適切なコミット管理を行わなければならない。

- **変更ごとに提示**: 何らかの変更を加えるたびにコミットメッセージを作成・提示すること
- **簡潔なメッセージ**: コミットメッセージはなるべく簡潔に記述すること
- **小さい粒度**: コミットの粒度はなるべく小さくすること
- **提示のみ**: コミット実行はユーザーが行う。Claude Codeは提示のみ
- **プレフィックス規則**: Conventional Commitsに準拠したタイプを使用
  - `fix`: バグ修正
  - `feat`: 新機能追加
  - `docs`: ドキュメント更新
  - `style`: コードスタイル変更（ロジック変更なし）
  - `refactor`: リファクタリング（バグ修正・機能追加なし）
  - `test`: テスト追加・修正
  - `chore`: メンテナンス・補助タスク

**根拠**: 適切なコミット管理により、変更履歴の追跡、問題の特定、ロールバックが容易になる。
小さい粒度のコミットは、レビューを効率化し、問題発生時の影響範囲を最小化する。
Conventional Commitsに準拠することで、自動化ツールとの連携や変更履歴の可読性が向上する。

## 技術制約 (Technical Constraints)

### 必須要件

- **言語**: TypeScript（型安全性の確保）
- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono（Cloudflare Workers最適化済み）
- **エージェント**: Mastra（LLMエージェント開発）

### パフォーマンス目標

- 初回応答時間: 3秒以内（Cold Start含む）
- 対話的な応答: 5秒以内
- 仕様書生成時間: 10分以内（中規模プロジェクト）

### スケール目標

- 同時接続ユーザー: 10人程度（小規模チーム想定）
- 1日あたりの仕様書生成: 10件程度
- エージェントの会話履歴保持: 全会話履歴を常にカバー（コンテキストエンジニアリングにより
  適切な情報量で文脈を維持し、会話の最初から最新までの全体的な流れを把握できること）

## 開発ワークフロー (Development Workflow)

### 機能開発フロー

1. **進捗確認**: PROGRESS.mdを参照し、現在の位置と次のタスクを確認
2. **要件定義**: ユーザーストーリーと受け入れ基準を日本語で作成
3. **テスト作成**: 受け入れ基準に基づいてテストを作成（失敗することを確認）
4. **設計**: アーキテクチャとデータモデルを設計（日本語ドキュメント）
5. **実装**: テストを通すための最小限の実装
6. **リファクタリング**: コード品質の向上
7. **ドキュメント**: 実装内容を日本語で文書化
8. **進捗更新**: PROGRESS.mdを更新（完了タスクをチェック、進捗率を更新）
9. **レビュー**: Constitution準拠を確認

### 品質ゲート

- すべてのテストが成功していること
- 日本語ドキュメントが完備されていること
- Cloudflare Workers制約を満たしていること
- 対話的な動作確認が完了していること
- PROGRESS.mdが最新状態に更新されていること

### コードレビュー基準

- Constitution準拠の確認
- テストカバレッジの確認
- 日本語コメント・ドキュメントの確認
- Cloudflareベストプラクティスの確認
- セキュリティ考慮事項の確認
- PROGRESS.md更新の確認

## Governance

### 憲法の位置づけ

この憲法はすべての開発実践に優先する。憲法に反する実装、設計、ドキュメントは
受け入れられない。

### 改訂手続き

憲法の改訂には以下が必要である:

1. 改訂提案の文書化（改訂理由、影響範囲、移行計画）
2. プロジェクトメンバーの承認
3. 依存する全テンプレートとドキュメントの更新
4. セマンティックバージョニングに基づくバージョン更新

### バージョニングポリシー

- **MAJOR**: 原則の削除または後方互換性のない変更
- **MINOR**: 新しい原則の追加または既存原則の大幅な拡張
- **PATCH**: 明確化、文言修正、非意味的な改良

### コンプライアンスレビュー

- すべてのPRはConstitution準拠を検証すること
- 複雑性の導入は正当化が必要
- 原則違反は明示的に文書化し、承認を得ること

### ランタイムガイダンス

開発時の詳細なガイダンスは、各テンプレートファイル、PROGRESS.md、および
プロジェクトREADME.md、CLAUDE.mdを参照すること。

**Version**: 1.2.0 | **Ratified**: 2025-10-23 | **Last Amended**: 2025-10-24
