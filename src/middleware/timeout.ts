import { timeout } from 'hono/timeout'
import { HTTPException } from 'hono/http-exception'

/**
 * タイムアウトミドルウェア
 *
 * リクエスト処理が60秒を超えた場合、504 Gateway Timeoutエラーを返します。
 * LLM APIコール（Gemini 2.5 Flash）の処理時間を考慮した設定です。
 *
 * 注記: Cloudflare WorkersのCPU時間制限（30秒）とは別概念です。
 * LLM API待機時間はCPU時間にカウントされないため、60秒設定が可能です。
 */
export const timeoutMiddleware = timeout(
  60000, // 60秒
  () => new HTTPException(504, { message: 'Request timeout' })
)
