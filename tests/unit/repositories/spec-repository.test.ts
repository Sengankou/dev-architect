import { describe, it, expect, beforeEach } from "vitest";
// @ts-ignore - cloudflare:test は @cloudflare/vitest-pool-workers によって提供される
import { env } from "cloudflare:test";
import { SpecRepository } from "../../../src/repositories/spec-repository";
import type { Analysis, Architecture } from "../../../src/types/entities";

/**
 * SpecRepositoryの単体テスト
 *
 * D1データベース操作（create, findById, findLatest）をテストします。
 * @cloudflare/vitest-pool-workersにより、実際のD1環境でテストされます。
 */

describe("SpecRepository", () => {
  let repository: SpecRepository;

  beforeEach(() => {
    // テスト用D1データベースインスタンスを取得
    repository = new SpecRepository(env.dev_architect_db);
  });

  describe("create", () => {
    it("should insert a new spec and return the ID", async () => {
      const analysis: Analysis = {
        mainPurpose: "テスト分析の主目的",
        targetUsers: "エンジニアリングマネージャー",
        keyFeatures: ["機能1", "機能2"],
      };

      const architecture: Architecture = {
        techStack: ["TypeScript", "Cloudflare Workers", "Hono"],
        deployment: "Cloudflare Workers",
        scalability: "エッジコンピューティングによる自動スケール",
      };

      const id = await repository.create({
        requirements: "テスト要件",
        projectName: "TestProject",
        analysis,
        architecture,
        specDraft: "# テスト仕様書",
      });

      expect(id).toBeGreaterThan(0);
    });

    it("should handle null projectName", async () => {
      const analysis: Analysis = {
        mainPurpose: "テスト分析",
        targetUsers: "テストユーザー",
        keyFeatures: [],
      };

      const architecture: Architecture = {
        techStack: [],
        deployment: "テスト環境",
        scalability: "小規模",
      };

      const id = await repository.create({
        requirements: "テスト要件",
        projectName: null,
        analysis,
        architecture,
        specDraft: "# テスト",
      });

      expect(id).toBeGreaterThan(0);
    });
  });

  describe("findById", () => {
    it("should return spec when found", async () => {
      const analysis: Analysis = {
        mainPurpose: "テスト分析",
        targetUsers: "エンジニア",
        keyFeatures: ["機能1"],
      };

      const architecture: Architecture = {
        techStack: ["TypeScript"],
        deployment: "Cloudflare Workers",
        scalability: "自動スケール",
      };

      const id = await repository.create({
        requirements: "テスト要件",
        projectName: "TestProject",
        analysis,
        architecture,
        specDraft: "# テスト仕様書",
      });

      const spec = await repository.findById(id);

      expect(spec).toBeDefined();
      expect(spec?.requirements).toBe("テスト要件");
      expect(spec?.projectName).toBe("TestProject");
      expect(spec?.analysis.mainPurpose).toBe("テスト分析");
    });

    it("should return null when not found", async () => {
      const spec = await repository.findById(99999);
      expect(spec).toBeNull();
    });
  });

  describe("findLatest", () => {
    it("should return specs in descending order by created_at", async () => {
      // 複数のspecを作成
      const analysis: Analysis = {
        mainPurpose: "テスト",
        targetUsers: "テストユーザー",
        keyFeatures: [],
      };
      const architecture: Architecture = {
        techStack: [],
        deployment: "テスト",
        scalability: "小規模",
      };

      await repository.create({
        requirements: "要件1",
        projectName: null,
        analysis,
        architecture,
        specDraft: "# 仕様書1",
      });

      await repository.create({
        requirements: "要件2",
        projectName: null,
        analysis,
        architecture,
        specDraft: "# 仕様書2",
      });

      const specs = await repository.findLatest(10);

      expect(specs.length).toBeGreaterThanOrEqual(2);
      expect(specs[0].requirements).toBe("要件2"); // 新しい方が先
    });

    it("should respect the limit parameter", async () => {
      const specs = await repository.findLatest(1);
      expect(specs.length).toBeLessThanOrEqual(1);
    });
  });
});
