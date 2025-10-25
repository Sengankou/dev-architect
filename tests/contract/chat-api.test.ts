/**
 * Chat API Contract Tests
 *
 * TDD: Red phase - このテストは実装完了までFAILします
 * Phase 3: User Story 1 - 対話的入力
 */

import { describe, it, expect } from 'vitest'

describe('POST /api/chat - Contract Tests', () => {
  it.todo('should create new session and return AI response')
  it.todo('should continue existing session with context')
  it.todo('should return 400 for empty message')
  it.todo('should return 400 for message exceeding 100KB')
  it.todo('should return 400 for message with invalid control characters')
  it.todo('should return 404 for non-existent session ID')
  it.todo('should return 503 when KV storage fails')
})

describe('GET /api/chat/:sessionId/history - Contract Tests', () => {
  it.todo('should return message history in chronological order')
  it.todo('should return empty array for new session')
  it.todo('should return 404 for non-existent session')
})
