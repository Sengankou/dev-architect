/**
 * Chat API Routes
 *
 * Phase 2: 対話フロー + セッション管理
 * - POST /api/chat: マルチターン会話
 * - GET /api/chat/:sessionId/history: 会話履歴取得
 */

import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { SessionRepository } from '../repositories/session-repository'
import { MessageRepository } from '../repositories/message-repository'
import { ChatHistoryService } from '../services/chat-history'
import { requirementRefinerAgent } from '../mastra/agents/requirement-refiner'
import { validateMessageContent } from '../middleware/message-validator'
import { logInfo, logError } from '../utils/logger'
import type { Message } from '../types/entities'

type Bindings = {
  dev_architect_db: D1Database
  DEV_ARCHITECT_SESSIONS: KVNamespace
  // CHAT_RATE_LIMIT: RateLimit // Phase 2で後ほど追加
}

const chat = new Hono<{ Bindings: Bindings }>()

/**
 * POST /api/chat
 *
 * マルチターン会話エンドポイント
 */
chat.post('/', async (c) => {
  const body = await c.req.json<{
    sessionId?: string
    message: string
  }>()

  const { sessionId: inputSessionId, message } = body

  // FR-013: メッセージバリデーション
  if (!message || message.trim().length === 0) {
    return c.json(
      {
        error: 'message is required',
        details: 'リクエストボディに\'message\'フィールドが必要です',
      },
      400
    )
  }

  const validation = validateMessageContent(message)
  if (!validation.valid) {
    return c.json(
      {
        error: 'invalid content',
        details: validation.error,
      },
      400
    )
  }

  // セッションID生成または検証
  const sessionId = inputSessionId || uuidv4()
  const now = Math.floor(Date.now() / 1000)

  // TODO: Rate Limiting（Phase 2で後ほど実装）
  // const { success } = await c.env.CHAT_RATE_LIMIT.limit({
  //   key: `session:${sessionId}`,
  //   rate: 10,
  //   period: 60,
  // })
  // if (!success) {
  //   return c.json(
  //     {
  //       error: 'rate limit exceeded',
  //       details: 'レート制限に達しました。しばらく待ってから再試行してください。',
  //     },
  //     429
  //   )
  // }

  // KVから会話履歴読み込み
  const chatHistoryService = new ChatHistoryService(c.env.DEV_ARCHITECT_SESSIONS)
  let history
  try {
    history = await chatHistoryService.load(sessionId)
    logInfo('Chat history loaded from KV', { sessionId, messageCount: history.messages.length })
  } catch (err) {
    logError('Failed to load chat history from KV', err)
    return c.json(
      {
        error: 'service unavailable',
        details: '会話履歴の読み込みに失敗しました。しばらく待ってから再試行してください。',
      },
      503
    )
  }

  // ユーザーメッセージ追加
  const userMessage: Message = {
    id: uuidv4(),
    sessionId,
    role: 'user',
    content: message,
    createdAt: now,
  }
  history.messages.push(userMessage)

  // Mastra Agent実行（会話履歴をコンテキストに含める）
  const conversationContext = history.messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join('\n')

  let aiResponse
  try {
    const response = await requirementRefinerAgent.generate(conversationContext)
    aiResponse = response.text
    logInfo('AI response generated', { sessionId, responseLength: aiResponse.length })
  } catch (err) {
    logError('Failed to generate AI response', err)
    return c.json(
      {
        error: 'service unavailable',
        details: 'AI応答の生成に失敗しました。しばらく待ってから再試行してください。',
      },
      503
    )
  }

  // AI応答メッセージ追加
  const assistantMessage: Message = {
    id: uuidv4(),
    sessionId,
    role: 'assistant',
    content: aiResponse,
    createdAt: Math.floor(Date.now() / 1000),
  }
  history.messages.push(assistantMessage)

  // KVに保存
  try {
    await chatHistoryService.save(history)
    logInfo('Chat history saved to KV', { sessionId, totalMessages: history.messages.length })
  } catch (err) {
    logError('Failed to save chat history to KV', err)
    // KV保存失敗は致命的なエラーとして扱う
    return c.json(
      {
        error: 'service unavailable',
        details: '会話履歴の保存に失敗しました。',
      },
      503
    )
  }

  // D1に保存（ベストエフォート型、Clarifications Q1）
  try {
    const sessionRepo = new SessionRepository(c.env.dev_architect_db)
    const messageRepo = new MessageRepository(c.env.dev_architect_db)

    if (!inputSessionId) {
      // 新規セッション作成
      await sessionRepo.create({
        id: sessionId,
        createdAt: now,
        updatedAt: now,
        status: 'active',
      })
      logInfo('New session created in D1', { sessionId })
    } else {
      // 既存セッション更新
      await sessionRepo.updateUpdatedAt(sessionId, now)
      logInfo('Session updated in D1', { sessionId })
    }

    await messageRepo.create(userMessage)
    await messageRepo.create(assistantMessage)
    logInfo('Messages saved to D1 successfully', { sessionId, messageIds: [userMessage.id, assistantMessage.id] })
  } catch (dbError) {
    // D1保存失敗でもKV成功なら200返却（ベストエフォート型）
    logError('Failed to save to D1 (best-effort persistence)', dbError)
  }

  return c.json({
    sessionId,
    response: aiResponse,
  })
})

/**
 * GET /api/chat/:sessionId/history
 *
 * 会話履歴取得エンドポイント
 */
chat.get('/:sessionId/history', async (c) => {
  const sessionId = c.req.param('sessionId')

  // KVから会話履歴取得
  const chatHistoryService = new ChatHistoryService(c.env.DEV_ARCHITECT_SESSIONS)
  let history
  try {
    history = await chatHistoryService.load(sessionId)
    logInfo('Chat history retrieved from KV', { sessionId, messageCount: history.messages.length })
  } catch (err) {
    logError('Failed to load chat history from KV', err)

    // KV失敗時はD1からフォールバック
    try {
      const messageRepo = new MessageRepository(c.env.dev_architect_db)
      const messages = await messageRepo.findBySessionId(sessionId)
      logInfo('Chat history fallback to D1', { sessionId, messageCount: messages.length })
      return c.json({ sessionId, messages })
    } catch (dbError) {
      logError('Failed to load chat history from D1', dbError)
      return c.json(
        {
          error: 'service unavailable',
          details: '会話履歴の読み込みに失敗しました。',
        },
        503
      )
    }
  }

  return c.json({
    sessionId,
    messages: history.messages,
  })
})

export default chat
