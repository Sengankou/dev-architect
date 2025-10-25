// @ts-ignore - cloudflare:test は @cloudflare/vitest-pool-workers によって提供される
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

/**
 * テストセットアップ: D1マイグレーションを自動適用
 *
 * 各テスト実行前に、TEST_MIGRATIONSバインディングから取得した
 * マイグレーションをD1データベースに適用します。
 */
beforeAll(async () => {
  // vitest.config.tsのbindingsから取得
  const migrations = env.TEST_MIGRATIONS as unknown as Migration[];

  // D1データベースにマイグレーションを適用
  await applyD1Migrations(env.dev_architect_db, migrations);
});

// Migration型の定義（Cloudflare Workers型）
interface Migration {
  name: string;
  sql: string;
}
