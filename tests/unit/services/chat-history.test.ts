/**
 * ChatHistoryService Unit Tests
 *
 * TDD: Red phase - このテストは現在FAILするはず（実装がまだ不完全な可能性があるため）
 * Phase 3: User Story 1 - 対話的入力
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatHistoryService } from '../../../src/services/chat-history'
import type { ChatHistory } from '../../../src/types/entities'

describe('ChatHistoryService', () => {
  let service: ChatHistoryService
  let mockKV: KVNamespace

  beforeEach(() => {
    mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace

    service = new ChatHistoryService(mockKV)
  })

  describe('load', () => {
    it('should return empty history for new session', async () => {
      const result = await service.load('new-session-id')

      expect(result.sessionId).toBe('new-session-id')
      expect(result.messages).toEqual([])
      expect(result.lastUpdatedAt).toBeGreaterThan(0)
      expect(mockKV.get).toHaveBeenCalledWith(
        'chat:session:new-session-id:messages',
        'json'
      )
    })

    it('should return existing history when found', async () => {
      const mockHistory: ChatHistory = {
        sessionId: 'existing-session',
        messages: [
          {
            id: 'msg-1',
            sessionId: 'existing-session',
            role: 'user',
            content: 'テスト',
            createdAt: 1729900000,
          },
        ],
        lastUpdatedAt: 1729900000,
      }

      mockKV.get = vi.fn().mockResolvedValue(mockHistory)

      const result = await service.load('existing-session')

      expect(result).toEqual(mockHistory)
    })
  })

  describe('save', () => {
    it('should save history to KV', async () => {
      const history: ChatHistory = {
        sessionId: 'test-session',
        messages: [
          {
            id: 'msg-1',
            sessionId: 'test-session',
            role: 'user',
            content: 'テスト',
            createdAt: 1729900000,
          },
        ],
        lastUpdatedAt: 1729900000,
      }

      await service.save(history)

      expect(mockKV.put).toHaveBeenCalledWith(
        'chat:session:test-session:messages',
        expect.any(String)
      )
    })

    it('should enforce 50-message window (FR-015)', async () => {
      // 55件のメッセージを持つ履歴を作成
      const messages = Array.from({ length: 55 }, (_, i) => ({
        id: `msg-${i}`,
        sessionId: 'test-session',
        role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
        content: `メッセージ ${i}`,
        createdAt: 1729900000 + i,
      }))

      const history: ChatHistory = {
        sessionId: 'test-session',
        messages,
        lastUpdatedAt: 1729900000,
      }

      await service.save(history)

      // 保存後、メッセージが50件に削減されていることを確認
      expect(history.messages.length).toBe(50)
      // 最新50件が保持されていることを確認（最初の5件が削除される）
      expect(history.messages[0].id).toBe('msg-5')
      expect(history.messages[49].id).toBe('msg-54')
    })

    it('should update lastUpdatedAt timestamp', async () => {
      const history: ChatHistory = {
        sessionId: 'test-session',
        messages: [],
        lastUpdatedAt: 1729900000,
      }

      const beforeSave = history.lastUpdatedAt

      await service.save(history)

      expect(history.lastUpdatedAt).toBeGreaterThan(beforeSave)
    })
  })
})
