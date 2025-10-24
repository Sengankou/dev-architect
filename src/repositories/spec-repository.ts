import type { Analysis, Architecture, Spec, SpecRow } from '../types/entities'

/**
 * Specリポジトリクラス
 *
 * D1データベースのspecsテーブルへのアクセスを提供します。
 * リポジトリパターンを採用し、データアクセスロジックをカプセル化します。
 */
export class SpecRepository {
  constructor(private db: D1Database) {}

  /**
   * 新しい仕様書をD1に保存
   *
   * @param spec - 保存する仕様書データ
   * @returns 挿入されたレコードのID
   * @throws Error - D1への挿入が失敗した場合
   */
  async create(spec: {
    requirements: string
    projectName: string | null
    analysis: Analysis
    architecture: Architecture
    specDraft: string
  }): Promise<number> {
    // JSON.stringify()でオブジェクトをJSON文字列に変換してD1に保存
    const result = await this.db
      .prepare(`
        INSERT INTO specs (requirements, project_name, analysis_json, architecture_json, spec_draft, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        spec.requirements,
        spec.projectName,
        JSON.stringify(spec.analysis),
        JSON.stringify(spec.architecture),
        spec.specDraft,
        Date.now()
      )
      .run()

    if (!result.success) {
      throw new Error('Failed to insert spec')
    }

    // D1のlast_insert_rowid()で挿入されたIDを取得
    const lastId = await this.db
      .prepare('SELECT last_insert_rowid() as id')
      .first<{ id: number }>()

    return lastId?.id ?? 0
  }

  /**
   * IDで仕様書を取得
   *
   * @param id - 仕様書ID
   * @returns 仕様書データ（存在しない場合はnull）
   */
  async findById(id: number): Promise<Spec | null> {
    const row = await this.db
      .prepare('SELECT * FROM specs WHERE id = ?')
      .bind(id)
      .first<SpecRow>()

    if (!row) return null

    // JSON文字列をパースしてオブジェクトに変換
    return {
      id: row.id,
      requirements: row.requirements,
      projectName: row.project_name,
      analysis: JSON.parse(row.analysis_json),
      architecture: JSON.parse(row.architecture_json),
      specDraft: row.spec_draft,
      createdAt: new Date(row.created_at),
    }
  }

  /**
   * 最新の仕様書を取得
   *
   * created_atインデックスを使用して効率的に取得します。
   *
   * @param limit - 取得件数（デフォルト: 10）
   * @returns 仕様書の配列（新しい順）
   */
  async findLatest(limit: number = 10): Promise<Spec[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM specs ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all<SpecRow>()

    // 各行のJSON文字列をパース
    return results.map(row => ({
      id: row.id,
      requirements: row.requirements,
      projectName: row.project_name,
      analysis: JSON.parse(row.analysis_json),
      architecture: JSON.parse(row.architecture_json),
      specDraft: row.spec_draft,
      createdAt: new Date(row.created_at),
    }))
  }
}
