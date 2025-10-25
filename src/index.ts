import { Hono } from "hono";
import spec from "./routes/spec";
import chat from "./routes/chat";
import { errorHandler } from "./middleware/error-handler";

// Cloudflare Wrangler が自動生成した型を利用
// Env 型は worker-configuration.d.ts から global に解決される

const app = new Hono<{ Bindings: Env }>();

// グローバルエラーハンドラを登録
app.onError(errorHandler);

// APIルート
app.get("/api", (c) =>
  c.json({ message: "dev-architect API running", version: "1.0.0" }),
);

// 仕様書生成APIを登録
app.route("/api/spec", spec);

// チャットAPIを登録
app.route("/api/chat", chat);

// public/index.htmlから呼ばれるエンドポイント
app.get("/message", (c) => c.text("Dev Architect - 要件定義支援エージェント"));

// KVテスト
app.get("/api/kv", async (c) => {
  try {
    // KVへ書き込み
    await c.env.DEV_ARCHITECT_SESSIONS.put("test3", "disabled");

    // KVから取得
    const value = await c.env.DEV_ARCHITECT_SESSIONS.get("test3");

    // 値が存在しない場合
    if (value === null) {
      return c.text("Value not found", 404);
    }

    // 値が存在する場合
    return c.text(value);
  } catch (err) {
    console.error("KV returned error:", err);
    const message =
      err instanceof Error
        ? err.message
        : "An unknown error occurred when accessing KV storage";
    return c.text(message, 500);
  }
});

export default app;
