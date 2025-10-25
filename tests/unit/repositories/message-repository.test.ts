/**
 * MessageRepository Unit Tests
 *
 * TDD: Red phase - このテストは現在FAILするはず（実装がまだ不完全な可能性があるため）
 * Phase 3: User Story 1 - 対話的入力
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageRepository } from '../../../src/repositories/message-repository'
import type { Message } from '../../../src/types/entities'

describe('MessageRepository', () => {
  let repository: MessageRepository
  let mockD1: D1Database

  beforeEach(() => {
    const mockResult = { success: true, meta: {} }
    const mockPrepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue(mockResult),
      all: vi.fn().mockResolvedValue({ results: [] }),
    })

    mockD1 = {
      prepare: mockPrepare,
    } as unknown as D1Database

    repository = new MessageRepository(mockD1)
  })

  describe('create', () => {
    it('should create a new message', async () => {
      const message: Message = {
        id: 'msg-123',
        sessionId: 'session-123',
        role: 'user',
        content: 'テストメッセージ',
        createdAt: 1729900000,
      }

      await repository.create(message)

      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages')
      )
    })
  })

  describe('findBySessionId', () => {
    it('should return empty array when no messages found', async () => {
      const result = await repository.findBySessionId('session-123')

      expect(result).toEqual([])
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM messages')
      )
    })

    it('should return messages in chronological order', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          session_id: 'session-123',
          role: 'user',
          content: '最初のメッセージ',
          created_at: 1729900000,
        },
        {
          id: 'msg-2',
          session_id: 'session-123',
          role: 'assistant',
          content: 'AI応答',
          created_at: 1729900005,
        },
      ]

      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: mockMessages }),
      })

      mockD1.prepare = mockPrepare

      const result = await repository.findBySessionId('session-123')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'msg-1',
        sessionId: 'session-123',
        role: 'user',
        content: '最初のメッセージ',
        createdAt: 1729900000,
      })
      expect(result[1]).toEqual({
        id: 'msg-2',
        sessionId: 'session-123',
        role: 'assistant',
        content: 'AI応答',
        createdAt: 1729900005,
      })
    })
  })
})
