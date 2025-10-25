import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { SpecGeneratorService } from "../services/spec-generator";
import { SpecRepository } from "../repositories/spec-repository";
import { specRequestSchema } from "../utils/validation";
import { payloadSizeCheck } from "../middleware/payload-size-check";
import { timeoutMiddleware } from "../middleware/timeout";
import { logError, logInfo } from "../utils/logger";
import type { SpecResponse } from "../types/response";

/**
 * /api/spec ルート
 *
 * POST /api/spec: 要件から仕様書を生成し、D1に保存します。
 *
 * 処理フロー:
 * 1. リクエストバリデーション（zod）
 * 2. ペイロードサイズチェック（100KB制限）
 * 3. タイムアウト設定（60秒）
 * 4. SpecGeneratorServiceで仕様書生成
 * 5. SpecRepositoryでD1に保存（ベストエフォート）
 * 6. レスポンス返却
 */

const spec = new Hono<{ Bindings: Cloudflare.Env }>();

spec.post(
  "/",
  payloadSizeCheck, // 100KB制限
  timeoutMiddleware, // 60秒タイムアウト
  zValidator("json", specRequestSchema), // zodバリデーション
  async (c) => {
    const { requirements, projectName } = c.req.valid("json");

    logInfo("Spec generation started", { projectName });

    try {
      // Step 1: 仕様書生成（Mastraワークフロー呼び出し）
      const service = new SpecGeneratorService();
      const specResponse = await service.generate(requirements, projectName);

      // Step 2: D1に保存（ベストエフォート型：失敗してもユーザーには200を返す）
      try {
        const repository = new SpecRepository(c.env.dev_architect_db);
        await repository.create({
          requirements,
          projectName: projectName || null,
          analysis: specResponse.analysis,
          architecture: specResponse.architecture,
          specDraft: specResponse.specificationDraft,
        });
        logInfo("Spec saved to D1 successfully");
      } catch (dbError) {
        // D1保存失敗はログのみ記録（FR-012: ベストエフォート型永続化）
        logError("Failed to save spec to D1", dbError);
      }

      // Step 3: レスポンス返却
      return c.json<SpecResponse>(specResponse, 200);
    } catch (error) {
      // エラーは上位のerrorHandlerで処理される
      throw error;
    }
  },
);

export default spec;
