import { z } from 'zod'

/**
 * バリデーションユーティリティ
 *
 * zodスキーマ定義とバリデーションヘルパー関数を提供します。
 */

/**
 * SpecRequestのzodスキーマ
 *
 * POST /api/spec のリクエストボディをバリデーションします。
 */
export const specRequestSchema = z.object({
  /** 要件テキスト（必須、最小1文字） */
  requirements: z.string().min(1, 'Requirements is required'),
  /** プロジェクト名（任意、最大255文字） */
  projectName: z.string().max(255, 'Project name must not exceed 255 characters').optional(),
})

/**
 * zodスキーマでバリデーションを実行
 *
 * @param schema - zodスキーマ
 * @param data - バリデーション対象データ
 * @returns パース済みデータ
 * @throws ZodError - バリデーションエラー
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data)
}
