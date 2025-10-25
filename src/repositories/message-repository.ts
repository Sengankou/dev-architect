/**
 * MessageRepository
 *
 * メッセージ（セッション内の個別発言）のD1データベース操作を担当します。
 * Phase 2: 対話フロー + セッション管理
 */

import type { Message } from '../types/entities'

export class MessageRepository {
  constructor(private db: D1Database) {}

  /**
   * メッセージを作成
   */
  async create(message: Message): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO messages (id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.createdAt
      )
      .run()
  }

  /**
   * セッションIDでメッセージ一覧を取得（時系列順）
   */
  async findBySessionId(sessionId: string): Promise<Message[]> {
    const results = await this.db
      .prepare(`
        SELECT * FROM messages
        WHERE session_id = ?
        ORDER BY created_at ASC
      `)
      .bind(sessionId)
      .all<{
        id: string
        session_id: string
        role: string
        content: string
        created_at: number
      }>()

    return results.results.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      createdAt: row.created_at,
    }))
  }
}
