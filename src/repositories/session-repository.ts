/**
 * SessionRepository
 *
 * セッション（会話の単位）のD1データベース操作を担当します。
 * Phase 2: 対話フロー + セッション管理
 */

import type { Session } from '../types/entities'

export class SessionRepository {
  constructor(private db: D1Database) {}

  /**
   * セッションを作成
   */
  async create(session: Session): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO sessions (id, created_at, updated_at, status)
        VALUES (?, ?, ?, ?)
      `)
      .bind(session.id, session.createdAt, session.updatedAt, session.status)
      .run()
  }

  /**
   * セッションIDでセッションを取得
   */
  async findById(id: string): Promise<Session | null> {
    const result = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .bind(id)
      .first<{
        id: string
        created_at: number
        updated_at: number
        status: string
      }>()

    if (!result) return null

    return {
      id: result.id,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      status: result.status as 'active' | 'archived' | 'deleted',
    }
  }

  /**
   * セッションの最終更新日時を更新
   */
  async updateUpdatedAt(id: string, updatedAt: number): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
      .bind(updatedAt, id)
      .run()
  }
}
