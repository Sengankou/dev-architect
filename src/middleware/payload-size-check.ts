import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import type { MiddlewareHandler } from "hono";

/**
 * ペイロードサイズチェックミドルウェア
 *
 * リクエストボディが100KBを超える場合、413 Payload Too Largeエラーを返します。
 * RFC 7230準拠の2段階チェック（Content-Lengthヘッダー → ストリーミング監視）を実施します。
 *
 * 理由: Cloudflare Workersのメモリ制約（128MB）を考慮し、
 * 一般的な要件テキストを十分カバーしつつリソース消費を最適化するため。
 *
 * エラーはHTTPExceptionとしてthrowされ、app.onError()のグローバルエラーハンドラで
 * 統一的に処理されます。
 */
export const payloadSizeCheck: MiddlewareHandler = bodyLimit({
  maxSize: 100 * 1024, // 100KB
  onError: (c) => {
    // HTTPExceptionをthrowしてグローバルエラーハンドラに処理を委譲
    throw new HTTPException(413, {
      message: "Request body too large",
    });
  },
});
