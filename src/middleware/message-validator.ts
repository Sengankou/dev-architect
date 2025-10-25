/**
 * Message Validator
 *
 * メッセージ内容のバリデーションを行います。
 * - FR-013: 100KB制限、不正な制御文字チェック
 *
 * Phase 2: 対話フロー + セッション管理
 */

export type ValidationResult = {
  valid: boolean
  error?: string
}

/**
 * メッセージ内容のバリデーション
 */
export function validateMessageContent(content: string): ValidationResult {
  // FR-013: 1文字以上
  if (content.length === 0) {
    return {
      valid: false,
      error: 'メッセージは1文字以上である必要があります',
    }
  }

  // FR-013: 100KB以下
  const sizeInBytes = new TextEncoder().encode(content).length
  if (sizeInBytes > 100 * 1024) {
    return {
      valid: false,
      error: 'メッセージは100KB以下である必要があります',
    }
  }

  // FR-013: 不正な制御文字を含まない
  if (content.includes('\0')) {
    return {
      valid: false,
      error: 'メッセージに不正な制御文字が含まれています',
    }
  }

  return { valid: true }
}

/**
 * セッションIDのバリデーション（UUIDv4形式）
 */
export function validateSessionId(sessionId: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidv4Regex.test(sessionId)
}
