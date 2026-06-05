import { createServer } from "node:http";
import { watch } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
await loadLocalEnv();

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const isDevServer = process.env.DEV_SERVER === "1";
const appPasscode = process.env.APP_PASSCODE || "";
const openaiApiKey = process.env.OPENAI_API_KEY || "";
const openaiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const dataDir = process.env.DATA_DIR || (process.env.NODE_ENV === "production" ? "/data" : join(rootDir, "data"));
const dbPath = process.env.DATABASE_PATH || join(dataDir, isDevServer ? "fitness.dev.db" : "fitness.db");
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 6 * 1024 * 1024);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateWindowMs = 60_000;
const maxRequestsPerWindow = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);
const rateBuckets = new Map();
const reloadClients = new Set();
const db = await openDatabase();

const foodDatabase = [
  { name: "鸡蛋", aliases: ["egg", "鸡蛋", "蛋"], unit: "个", calories: 70, protein: 6, carbs: 0.6, fat: 5 },
  { name: "鸡胸肉", aliases: ["chicken", "鸡胸", "鸡胸肉"], unit: "100g", calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "牛肉", aliases: ["beef", "牛肉"], unit: "100g", calories: 250, protein: 26, carbs: 0, fat: 15 },
  { name: "三文鱼", aliases: ["salmon", "三文鱼"], unit: "100g", calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "米饭", aliases: ["rice", "米饭", "白饭"], unit: "100g", calories: 130, protein: 2.4, carbs: 28, fat: 0.3 },
  { name: "燕麦", aliases: ["oat", "oats", "燕麦"], unit: "50g", calories: 190, protein: 6.5, carbs: 32, fat: 3.5 },
  { name: "面包", aliases: ["bread", "吐司", "面包"], unit: "片", calories: 80, protein: 3, carbs: 14, fat: 1.2 },
  { name: "牛奶", aliases: ["milk", "牛奶"], unit: "250ml", calories: 150, protein: 8, carbs: 12, fat: 8 },
  { name: "酸奶", aliases: ["yogurt", "酸奶"], unit: "杯", calories: 120, protein: 9, carbs: 14, fat: 3 },
  { name: "香蕉", aliases: ["banana", "香蕉"], unit: "根", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: "苹果", aliases: ["apple", "苹果"], unit: "个", calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: "牛油果", aliases: ["avocado", "牛油果"], unit: "个", calories: 240, protein: 3, carbs: 13, fat: 22 },
  { name: "花生酱", aliases: ["peanut butter", "花生酱"], unit: "勺", calories: 95, protein: 3.5, carbs: 3.5, fat: 8 },
  { name: "蛋白粉", aliases: ["protein powder", "whey", "蛋白粉"], unit: "勺", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: "沙拉", aliases: ["salad", "沙拉"], unit: "份", calories: 180, protein: 6, carbs: 16, fat: 10 },
  { name: "橄榄油", aliases: ["olive oil", "橄榄油", "油"], unit: "勺", calories: 119, protein: 0, carbs: 0, fat: 13.5 }
];

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

async function loadLocalEnv() {
  try {
    const raw = await readFile(join(rootDir, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

createServer(async (req, res) => {
  try {
    applySecurityHeaders(res);

    if (req.method === "OPTIONS") {
      writeCors(req, res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === "/healthz") {
      sendJson(req, res, 200, { ok: true });
      return;
    }

    if (isDevServer && req.url === "/__dev/reload") {
      handleReloadStream(req, res);
      return;
    }

    if (isDevServer && req.url.startsWith("/__dev/clear")) {
      sendDevClearPage(res);
      return;
    }

    if (req.url === "/api/state") {
      if (!authorizeRequest(req, res)) return;
      await handleState(req, res);
      return;
    }

    if (req.url === "/api/analyze-meal-text" || req.url === "/api/analyze-meal-photo") {
      if (!authorizeRequest(req, res)) return;
      await handleAnalyze(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(req, res, error.status || 500, { error: error.message || "server_error" });
  }
}).listen(port, host, () => {
  console.log(`Fitness tracker listening on http://${host}:${port}`);
  if (isDevServer) console.log("Dev reload enabled");
  console.log(`SQLite persistence at ${dbPath}`);
});

if (isDevServer) {
  const watchedFiles = ["index.html", "styles.css", "app.js", "manifest.json", "service-worker.js"];
  for (const file of watchedFiles) {
    watch(join(rootDir, file), { persistent: false }, () => notifyReloadClients(file));
  }
}

async function handleAnalyze(req, res) {
  if (req.method !== "POST") {
    sendJson(req, res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!checkRateLimit(req)) {
    sendJson(req, res, 429, { error: "rate_limited" });
    return;
  }

  const body = await readJsonBody(req);
  const text = String(body.text || "");
  const correction = String(body.correction || "");
  const photos = normalizePhotoInputs(body);
  const hasPhoto = photos.length > 0;
  const draft = await createAnalysisDraft(text, hasPhoto, correction, photos);
  sendJson(req, res, 200, draft);
}

function authorizeRequest(req, res) {
  if (!appPasscode) return true;

  const passcode = String(req.headers["x-app-passcode"] || "");
  if (passcode && passcode === appPasscode) return true;

  sendJson(req, res, 401, { error: "unauthorized" });
  return false;
}

async function handleState(req, res) {
  if (req.method === "GET") {
    sendJson(req, res, 200, readStoredState());
    return;
  }

  if (req.method === "PUT") {
    if (!checkRateLimit(req)) {
      sendJson(req, res, 429, { error: "rate_limited" });
      return;
    }

    const body = await readJsonBody(req);
    const state = normalizeStoredState(body.state);
    writeStoredState(state);
    sendJson(req, res, 200, { ok: true, updatedAt: new Date().toISOString() });
    return;
  }

  sendJson(req, res, 405, { error: "method_not_allowed" });
}

async function openDatabase() {
  await mkdir(dataDir, { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return database;
}

function readStoredState() {
  const row = db.prepare("SELECT state_json, updated_at FROM app_state WHERE id = ?").get("default");
  if (!row) return { state: null, updatedAt: null };
  return { state: JSON.parse(row.state_json), updatedAt: row.updated_at };
}

function writeStoredState(state) {
  db.prepare(`
    INSERT INTO app_state (id, state_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = excluded.updated_at
  `).run("default", JSON.stringify(state), new Date().toISOString());
}

function normalizeStoredState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw Object.assign(new Error("invalid_state"), { status: 400 });
  }
  return state;
}

async function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, safePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    let data = await readFile(filePath);
    const ext = extname(filePath);
    if (isDevServer && ext === ".html") {
      data = injectDevReload(data);
    }
    res.writeHead(200, {
      "Cache-Control": isDevServer ? "no-store" : ext === ".html" ? "no-cache" : "public, max-age=3600",
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    if (req.method !== "HEAD") res.end(data);
    else res.end();
  } catch {
    let index = await readFile(join(rootDir, "index.html"));
    if (isDevServer) index = injectDevReload(index);
    res.writeHead(200, {
      "Cache-Control": isDevServer ? "no-store" : "no-cache",
      "Content-Type": "text/html; charset=utf-8"
    });
    res.end(index);
  }
}

function handleReloadStream(req, res) {
  writeCors(req, res);
  res.writeHead(200, {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8"
  });
  res.write("event: ready\ndata: connected\n\n");
  reloadClients.add(res);
  req.on("close", () => reloadClients.delete(res));
}

function notifyReloadClients(file) {
  for (const client of reloadClients) {
    client.write(`event: reload\ndata: ${file}\n\n`);
  }
}

function injectDevReload(data) {
  const html = data.toString("utf8");
  const script = `
    <script>
      window.__FITNESS_DEV__ = true;
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      }
      new EventSource("/__dev/reload").addEventListener("reload", () => location.reload());
    </script>`;
  return Buffer.from(html.replace("</head>", `${script}\n  </head>`));
}

function sendDevClearPage(res) {
  res.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Clear-Site-Data": '"cache"'
  });
  res.end(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset dev cache</title>
  </head>
  <body>
    <p>Resetting local dev cache...</p>
    <script>
      Promise.all([
        "serviceWorker" in navigator
          ? navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister())))
          : Promise.resolve(),
        "caches" in window
          ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
          : Promise.resolve()
      ]).finally(() => {
        location.replace("/?dev=" + Date.now());
      });
    </script>
  </body>
</html>`);
}

async function createAnalysisDraft(text, hasPhoto, correction = "", photo = "") {
  let aiError = "";
  if (openaiApiKey) {
    try {
      return await createOpenAIAnalysisDraft(text, hasPhoto, correction, photo);
    } catch (error) {
      aiError = publicOpenAIErrorMessage(error);
      console.error("OpenAI meal analysis failed", error);
    }
  }

  const combinedText = [text, correction].filter(Boolean).join(" ");
  const estimate = estimateFromText(combinedText);
  const hasFoodMatch = estimate.matched.length > 0;
  const fallback = hasPhoto && !hasFoodMatch
    ? { calories: 550, protein: 25, carbs: 60, fat: 22, matched: ["照片餐食 x 1"] }
    : estimate;
  const fallbackItems = fallback.matched.map((food) => ({
    name: food,
    amount: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  }));

  return {
    text: combinedText.trim() || (hasPhoto ? "照片餐食" : ""),
    foods: fallback.matched,
    items: fallbackItems,
    calories: Math.round(fallback.calories),
    protein: round(fallback.protein),
    carbs: round(fallback.carbs),
    fat: round(fallback.fat),
    fiber: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    source: "fallback",
    warning: aiError
      ? `AI 分析暂时不可用，当前是本地粗略估算。${aiError}`
      : "当前是本地粗略估算，没有调用 AI。",
    message: hasFoodMatch
      ? "我先按这些食物估算。你可以继续更正份量或食材。"
      : hasPhoto
        ? "我先按照片生成一个粗略草稿。你可以补充食材和份量。"
      : "我需要更多食物信息才能估算。"
  };
}

async function createOpenAIAnalysisDraft(text, hasPhoto, correction, photos) {
  const combinedText = [text, correction].filter(Boolean).join("\n更正：").trim();
  const content = [
    {
      type: "input_text",
      text: [
        "请分析用户实际吃掉的食物和份量，估算热量和三大营养素。",
        "如果信息不足，请给一个保守估算，并在 message 里说明需要用户确认的地方。",
        "所有数值用 kcal 或 g。不要输出 markdown，只返回符合 schema 的 JSON。",
        `用户文字：${combinedText || "(没有文字，可能只有照片)"}`,
        `是否有照片：${hasPhoto ? "是" : "否"}`
      ].join("\n")
    }
  ];

  for (const photo of normalizePhotos(photos).slice(0, 4)) {
    content.push({
      type: "input_image",
      image_url: photo,
      detail: "low"
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openaiModel,
      instructions: [
        "你是一个谨慎的营养记录助手。",
        "目标是帮用户生成可编辑的餐食草稿，而不是医疗建议。",
        "识别食物时保留不确定性：不确定就写进 message。",
        "foods 使用短标签，例如 鸡胸肉 150g、米饭 200g、鸡蛋 2个。",
        "items 是用户实际吃喝的食物清单：每一样独立的食物或饮品只列为一项，用简短的整体名称（如“橙C美式”“番茄炒蛋”），包含 name、amount、calories、protein、carbs、fat。",
        "不要把同一样食物/饮品拆成它的配料或组成成分分别列出（例如“橙C美式”就是一项，不要再单独列出咖啡、橙汁、糖浆等），也不要既列整体又列它的组成而造成重复计算。",
        "items 各项 calories 之和应约等于总 calories。",
        "如果用户提供了更正，必须完整采纳所有更正，并在 message 里具体说明当前草稿如何变化以及还有哪些不确定点；不要只说“已更新”。",
        "calories、protein、carbs、fat、fiber、sodium、potassium、calcium、iron 必须是非负数字。"
      ].join("\n"),
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "meal_analysis",
          strict: true,
          schema: mealAnalysisSchema
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "openai_request_failed");
  }

  const outputText = payload.output_text || readResponseOutputText(payload);
  const parsed = JSON.parse(outputText);
  return normalizeOpenAIAnalysis(parsed, combinedText, hasPhoto);
}

const mealAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "foods", "items", "calories", "protein", "carbs", "fat", "fiber", "sodium", "potassium", "calcium", "iron", "message"],
  properties: {
    text: { type: "string" },
    foods: {
      type: "array",
      items: { type: "string" }
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "calories", "protein", "carbs", "fat"],
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" }
        }
      }
    },
    calories: { type: "number" },
    protein: { type: "number" },
    carbs: { type: "number" },
    fat: { type: "number" },
    fiber: { type: "number" },
    sodium: { type: "number" },
    potassium: { type: "number" },
    calcium: { type: "number" },
    iron: { type: "number" },
    message: { type: "string" }
  }
};

function readResponseOutputText(payload) {
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("");
}

function normalizeOpenAIAnalysis(parsed, text, hasPhoto) {
  const foods = Array.isArray(parsed.foods) ? parsed.foods.filter(Boolean).map(String) : [];
  const items = Array.isArray(parsed.items)
    ? parsed.items.map(normalizeFoodItem).filter(Boolean)
    : foods.map((food) => normalizeFoodItem({ name: food, amount: "", calories: 0, protein: 0, carbs: 0, fat: 0 })).filter(Boolean);

  return {
    text: String(parsed.text || text || (hasPhoto ? "照片餐食" : "")).trim(),
    foods,
    items,
    calories: Math.max(0, Math.round(Number(parsed.calories) || 0)),
    protein: round(Math.max(0, Number(parsed.protein) || 0)),
    carbs: round(Math.max(0, Number(parsed.carbs) || 0)),
    fat: round(Math.max(0, Number(parsed.fat) || 0)),
    fiber: round(Math.max(0, Number(parsed.fiber) || 0)),
    sodium: round(Math.max(0, Number(parsed.sodium) || 0)),
    potassium: round(Math.max(0, Number(parsed.potassium) || 0)),
    calcium: round(Math.max(0, Number(parsed.calcium) || 0)),
    iron: round(Math.max(0, Number(parsed.iron) || 0)),
    source: "ai",
    warning: "",
    message: String(parsed.message || "我先生成了一个餐食估算，请确认食材和份量。")
  };
}

function normalizeFoodItem(item) {
  if (!item || typeof item !== "object") return null;
  const name = String(item.name || "").trim();
  if (!name) return null;

  return {
    name,
    amount: String(item.amount || "").trim(),
    calories: Math.max(0, Math.round(Number(item.calories) || 0)),
    protein: round(Math.max(0, Number(item.protein) || 0)),
    carbs: round(Math.max(0, Number(item.carbs) || 0)),
    fat: round(Math.max(0, Number(item.fat) || 0))
  };
}

function publicOpenAIErrorMessage(error) {
  const message = String(error?.message || "");
  if (/quota|billing/i.test(message)) return "OpenAI quota 或 billing 需要检查。";
  if (/rate limit/i.test(message)) return "OpenAI rate limit，请稍后再试。";
  if (/model/i.test(message)) return "OpenAI 模型配置可能不可用。";
  return "请稍后再试。";
}

function normalizePhotoInputs(body) {
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (typeof body.photo === "string" && body.photo) photos.unshift(body.photo);
  return normalizePhotos(photos);
}

function normalizePhotos(photos) {
  return (Array.isArray(photos) ? photos : [photos])
    .filter((photo) => typeof photo === "string" && photo.startsWith("data:image/"));
}

function estimateFromText(text) {
  const normalized = text.toLowerCase();
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const matched = [];

  for (const food of foodDatabase) {
    const alias = food.aliases.find((item) => normalized.includes(item.toLowerCase()));
    if (!alias) continue;

    const quantity = readQuantityNearFood(normalized, alias, food);
    totals.calories += food.calories * quantity;
    totals.protein += food.protein * quantity;
    totals.carbs += food.carbs * quantity;
    totals.fat += food.fat * quantity;
    matched.push(`${food.name} x ${round(quantity, 2)}`);
  }

  return {
    ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, round(value)])),
    matched
  };
}

function readQuantityNearFood(text, alias, food) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const afterPattern = new RegExp(`${escaped}[\\u4e00-\\u9fa5a-zA-Z\\s]{0,2}(\\d+(?:\\.\\d+)?)(?:\\s*(g|克|ml|毫升|个|份|杯|片|勺))?`, "i");
  const beforePattern = new RegExp(`(\\d+(?:\\.\\d+)?)(?:\\s*(g|克|ml|毫升|个|份|杯|片|勺))?\\s*${escaped}`, "i");
  const after = text.match(afterPattern);
  const before = text.match(beforePattern);
  const match = after || before;
  const value = Number(match?.[1] || 1);
  const unit = match?.[2] || "";

  if (/^(g|克|ml|毫升)$/i.test(unit)) {
    const baseAmount = Number(food.unit.match(/\d+/)?.[0]) || 100;
    return Math.max(0.1, value / baseAmount);
  }

  return Math.max(0.1, value || 1);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error("payload_too_large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("invalid_json"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(req, res, status, payload) {
  writeCors(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function writeCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;

  if (!allowedOrigins.length || allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-App-Passcode");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  }
}

function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(), microphone=()");
}

function checkRateLimit(req) {
  const key = req.headers["fly-client-ip"] || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.start > rateWindowMs) {
    rateBuckets.set(key, { count: 1, start: now });
    return true;
  }

  bucket.count += 1;
  return bucket.count <= maxRequestsPerWindow;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
