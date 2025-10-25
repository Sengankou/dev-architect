import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  // D1マイグレーションファイルを読み込み
  const migrationsPath = path.join(__dirname, "migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    test: {
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          isolatedStorage: false,
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            compatibilityFlags: ["nodejs_compat"],
            compatibilityDate: "2024-09-09",
            // D1データベースを指定
            d1Databases: ["dev_architect_db"],
            // マイグレーションをテスト環境バインディングに渡す
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
