import { bodyLimit } from 'hono/body-limit'
import type { MiddlewareHandler } from 'hono'

/**
 * ペイロードサイズチェックミドルウェア
 *
 * リクエストボディが100KBを超える場合、413 Payload Too Largeエラーを返します。
 * RFC 7230準拠の2段階チェック（Content-Lengthヘッダー → ストリーミング監視）を実施します。
 *
 * 理由: Cloudflare Workersのメモリ制約（128MB）を考慮し、
 * 一般的な要件テキストを十分カバーしつつリソース消費を最適化するため。
 */
export const payloadSizeCheck: MiddlewareHandler = bodyLimit({
  maxSize: 100 * 1024, // 100KB
  onError: (c) => {
    // 413エラーとErrorResponse型準拠のJSONを返す
    return c.json(
      {
        error: {
          message: 'Request body too large',
          code: 'PAYLOAD_TOO_LARGE'
        }
      },
      413
    )
  },
})
