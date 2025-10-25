/**
 * SessionRepository Unit Tests
 *
 * TDD: Red phase - このテストは現在FAILするはず（実装がまだ不完全な可能性があるため）
 * Phase 3: User Story 1 - 対話的入力
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionRepository } from '../../../src/repositories/session-repository'
import type { Session } from '../../../src/types/entities'

describe('SessionRepository', () => {
  let repository: SessionRepository
  let mockD1: D1Database

  beforeEach(() => {
    // モックD1データベース作成
    const mockResult = { success: true, meta: {} }
    const mockPrepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue(mockResult),
      first: vi.fn().mockResolvedValue(null),
    })

    mockD1 = {
      prepare: mockPrepare,
    } as unknown as D1Database

    repository = new SessionRepository(mockD1)
  })

  describe('create', () => {
    it('should create a new session', async () => {
      const session: Session = {
        id: 'test-session-id-123',
        createdAt: 1729900000,
        updatedAt: 1729900000,
        status: 'active',
      }

      await repository.create(session)

      // D1 INSERTクエリが呼ばれたことを確認
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sessions')
      )
    })
  })

  describe('findById', () => {
    it('should return null when session not found', async () => {
      const result = await repository.findById('non-existent-id')

      expect(result).toBeNull()
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM sessions WHERE id = ?')
      )
    })

    it('should return session when found', async () => {
      // モックデータを返すように設定
      const mockSession = {
        id: 'test-session-id',
        created_at: 1729900000,
        updated_at: 1729900000,
        status: 'active',
      }

      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(mockSession),
      })

      mockD1.prepare = mockPrepare

      const result = await repository.findById('test-session-id')

      expect(result).toEqual({
        id: 'test-session-id',
        createdAt: 1729900000,
        updatedAt: 1729900000,
        status: 'active',
      })
    })
  })

  describe('updateUpdatedAt', () => {
    it('should update session updatedAt timestamp', async () => {
      const newUpdatedAt = 1729900100

      await repository.updateUpdatedAt('test-session-id', newUpdatedAt)

      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sessions SET updated_at = ?')
      )
    })
  })
})
