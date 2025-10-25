/**
 * ChatHistoryService
 *
 * KVストレージでの会話履歴管理を担当します。
 * - 50件ウィンドウ管理（FR-015）
 * - KV読み書き操作
 *
 * Phase 2: 対話フロー + セッション管理
 */

import type { ChatHistory, Message } from '../types/entities'

export class ChatHistoryService {
  constructor(private kv: KVNamespace) {}

  /**
   * KVキーを生成
   */
  private getKey(sessionId: string): string {
    return `chat:session:${sessionId}:messages`
  }

  /**
   * 会話履歴をKVから読み込み
   *
   * 新規セッションの場合は空の履歴を返します。
   */
  async load(sessionId: string): Promise<ChatHistory> {
    const key = this.getKey(sessionId)
    const data = await this.kv.get<ChatHistory>(key, 'json')

    if (!data) {
      // 新規セッション: 空の履歴を返す
      return {
        sessionId,
        messages: [],
        lastUpdatedAt: Math.floor(Date.now() / 1000),
      }
    }

    return data
  }

  /**
   * 会話履歴をKVに保存
   *
   * 50件ウィンドウ管理: 最新50件のみ保持（FR-015）
   */
  async save(history: ChatHistory): Promise<void> {
    const key = this.getKey(history.sessionId)

    // 50件ウィンドウ: 最新50件のみ保持（FR-015）
    if (history.messages.length > 50) {
      history.messages = history.messages.slice(-50)
    }

    history.lastUpdatedAt = Math.floor(Date.now() / 1000)

    await this.kv.put(key, JSON.stringify(history))
  }
}
