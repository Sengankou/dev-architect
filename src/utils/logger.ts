/**
 * ロギングユーティリティ
 *
 * Console APIラッパーで、エラーログ用の構造化ログ機能を提供します。
 */

/**
 * エラーログを出力
 *
 * @param message - エラーメッセージ
 * @param error - エラーオブジェクト（任意）
 */
export function logError(message: string, error?: unknown): void {
  console.error({
    level: 'ERROR',
    message,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 情報ログを出力
 *
 * @param message - ログメッセージ
 * @param data - 追加データ（任意）
 */
export function logInfo(message: string, data?: unknown): void {
  console.log({
    level: 'INFO',
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}

/**
 * 警告ログを出力
 *
 * @param message - 警告メッセージ
 * @param data - 追加データ（任意）
 */
export function logWarn(message: string, data?: unknown): void {
  console.warn({
    level: 'WARN',
    message,
    data,
    timestamp: new Date().toISOString(),
  })
}
