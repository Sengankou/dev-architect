<!-- Sync Impact Report:
Version change: 0.1.1 → 0.2.0
List of modified principles:
  - Added: VI. 日本語ドキュメンテーション
Added sections: N/A
Removed sections: N/A
Templates requiring updates:
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.specify/templates/plan-template.md: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.specify/templates/spec-template.md: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.specify/templates/tasks-template.md: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.analyze.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.checklist.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.clarify.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.constitution.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.implement.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.plan.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.specify.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/.gemini/commands/speckit.tasks.toml: ✅ updated
  - /Users/sengankou/Documents/PolarisAI/src/dev-architect/README.md: ⚠ pending
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Original adoption date unknown
-->
# dev-architect 憲章

## 基本原則

### I. ライブラリファースト
すべての機能は独立したライブラリとして開始されます。ライブラリは自己完結型で、独立してテスト可能であり、文書化されている必要があります。明確な目的が必要であり、組織専用のライブラリは作成しません。

### II. CLIインターフェース
すべてのライブラリはCLIを介して機能を提供します。テキスト入出力プロトコルは、stdin/引数 → stdout、エラー → stderrです。JSONと人間が読める形式をサポートします。

### III. テストファースト (交渉不可)
TDDは必須です。テストを作成 → ユーザー承認 → テスト失敗 → その後実装という流れを厳守します。レッド・グリーン・リファクタリングサイクルを厳密に適用します。

### IV. 統合テスト
統合テストが必要な重点分野は、新しいライブラリの契約テスト、契約変更、サービス間通信、共有スキーマです。

### V. 可観測性、バージョン管理と破壊的変更、シンプルさ
テキストI/Oはデバッグ可能性を保証します。構造化されたロギングが必須です。バージョンはMAJOR.MINOR.BUILD形式を使用します。シンプルに始め、YAGNI原則に従います。

### VI. 日本語ドキュメンテーション
すべての公式ドキュメンテーション（設計書、仕様書、README、コードコメントなど）は、明確で簡潔な日本語で記述されなければなりません。これにより、プロジェクトメンバー間の理解を深め、コミュニケーションを円滑にします。

## 追加の制約
技術スタック要件、コンプライアンス標準、デプロイポリシーなど。

## 開発ワークフロー
コードレビュー要件、テストゲート、デプロイ承認プロセスなど。

## ガバナンス
憲章は他のすべての慣行に優先します。修正には文書化、承認、移行計画が必要です。すべてのPR/レビューはコンプライアンスを検証する必要があります。複雑さは正当化されなければなりません。ランタイム開発ガイダンスには[GUIDANCE_FILE]を使用します。

**バージョン**: 0.2.0 | **承認日**: TODO(RATIFICATION_DATE): Original adoption date unknown | **最終改訂日**: 2025-10-22