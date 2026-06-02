import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "0.0.0.0";
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 6 * 1024 * 1024);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateWindowMs = 60_000;
const maxRequestsPerWindow = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);
const rateBuckets = new Map();

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
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

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

    if (req.url === "/api/analyze-meal-text" || req.url === "/api/analyze-meal-photo") {
      await handleAnalyze(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(req, res, error.status || 500, { error: error.message || "server_error" });
  }
}).listen(port, host, () => {
  console.log(`Fitness tracker listening on ${port}`);
});

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
  const hasPhoto = Boolean(body.photo);
  const draft = createAnalysisDraft(text, hasPhoto, correction);
  sendJson(req, res, 200, draft);
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
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, {
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    if (req.method !== "HEAD") res.end(data);
    else res.end();
  } catch {
    const index = await readFile(join(rootDir, "index.html"));
    res.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": "text/html; charset=utf-8"
    });
    res.end(index);
  }
}

function createAnalysisDraft(text, hasPhoto, correction = "") {
  const combinedText = [text, correction].filter(Boolean).join(" ");
  const estimate = estimateFromText(combinedText);
  const hasFoodMatch = estimate.matched.length > 0;
  const fallback = hasPhoto && !hasFoodMatch
    ? { calories: 550, protein: 25, carbs: 60, fat: 22, matched: ["照片餐食 x 1"] }
    : estimate;

  return {
    text: combinedText.trim() || (hasPhoto ? "照片餐食" : ""),
    foods: fallback.matched,
    calories: Math.round(fallback.calories),
    protein: round(fallback.protein),
    carbs: round(fallback.carbs),
    fat: round(fallback.fat),
    message: hasFoodMatch
      ? "我先按这些食物估算。你可以继续更正份量或食材。"
      : hasPhoto
        ? "我先按照片生成一个粗略草稿。你可以补充食材和份量。"
        : "我需要更多食物信息才能估算。"
  };
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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
