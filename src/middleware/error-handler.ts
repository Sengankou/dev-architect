import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import type { ErrorResponse } from "../types/response";

/**
 * グローバルエラーハンドラー
 *
 * app.onError()で使用し、HTTPException/ZodError/TimeoutErrorを捕捉して
 * ErrorResponse型のJSON（{error: {message, code}}）を返します。
 *
 * @param err - エラーオブジェクト
 * @param c - Honoコンテキスト
 * @returns ErrorResponse型のJSONレスポンス
 */
export function errorHandler(err: Error, c: Context) {
  console.error("Error:", err);

  // HTTPException: Honoの標準エラー（400, 413, 504など）
  if (err instanceof HTTPException) {
    return c.json<ErrorResponse>(
      {
        error: {
          message: err.message,
          code: getErrorCode(err.status),
        },
      },
      err.status,
    );
  }

  // ZodError: バリデーションエラー
  if (err instanceof ZodError) {
    return c.json<ErrorResponse>(
      {
        error: {
          message: "Validation failed",
          code: "INVALID_REQUEST",
        },
      },
      400,
    );
  }

  // TimeoutError: タイムアウト
  if (err.name === "TimeoutError") {
    return c.json<ErrorResponse>(
      {
        error: {
          message: "Request timeout",
          code: "TIMEOUT",
        },
      },
      504,
    );
  }

  // その他のエラー: 内部サーバーエラー
  return c.json<ErrorResponse>(
    {
      error: {
        message: err instanceof Error ? err.message : "Internal server error",
        code: "INTERNAL_ERROR",
      },
    },
    500,
  );
}

/**
 * HTTPステータスコードからエラーコードを取得
 *
 * @param status - HTTPステータスコード
 * @returns エラーコード文字列
 */
function getErrorCode(status: number): ErrorResponse["error"]["code"] {
  const codes: Record<number, ErrorResponse["error"]["code"]> = {
    400: "INVALID_REQUEST",
    413: "PAYLOAD_TOO_LARGE",
    500: "INTERNAL_ERROR",
    504: "TIMEOUT",
  };
  return codes[status] || "INTERNAL_ERROR";
}
