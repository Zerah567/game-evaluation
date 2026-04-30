require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const scoringSystem = require("./scoringSystem");

const app = express();

const PORT = process.env.PORT || 3000;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.deepseek.com";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "deepseek-v4-flash";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "reviews.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "game rating", "public")));

async function ensureDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

async function readReviews() {
  await ensureDatabase();
  const content = await fs.readFile(DB_FILE, "utf-8");
  try {
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeReviews(reviews) {
  await ensureDatabase();
  await fs.writeFile(DB_FILE, JSON.stringify(reviews, null, 2), "utf-8");
}

function normalizeGameName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function round1(num) {
  return Math.round(Number(num) * 10) / 10;
}

function round2(num) {
  return Math.round(Number(num) * 100) / 100;
}

function clampScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 5;
  return Math.min(10, Math.max(1, n));
}

function getLeafIndicators(nodes = scoringSystem.indicators) {
  const result = [];

  function walk(node) {
    if (!node.children || node.children.length === 0) {
      result.push({
        id: node.id,
        name: node.name,
        level: node.level,
        weight: node.weight
      });
      return;
    }

    node.children.forEach(walk);
  }

  nodes.forEach(walk);
  return result;
}

function calculateNodeScore(node, leafScores) {
  if (!node.children || node.children.length === 0) {
    const raw = leafScores[node.id];

    let score = 5;
    let reason = "AI 未提供该项原因，使用默认评分。";

    if (typeof raw === "number") {
      score = raw;
    } else if (raw && typeof raw === "object") {
      score = raw.score;
      reason = raw.reason || reason;
    }

    score = round1(clampScore(score));

    return {
      id: node.id,
      name: node.name,
      level: node.level,
      weight: node.weight,
      score,
      score100: round1(score * 10),
      reason
    };
  }

  const children = node.children.map((child) =>
    calculateNodeScore(child, leafScores)
  );

  const score = round1(
    children.reduce((sum, child) => {
      return sum + child.score * child.weight;
    }, 0)
  );

  return {
    id: node.id,
    name: node.name,
    level: node.level,
    weight: node.weight,
    score,
    score100: round1(score * 10),
    children
  };
}

function calculateReport(aiJson, requestedGameName) {
  const leafScores = aiJson.leafScores || aiJson.scores || {};

  const dimensions = scoringSystem.indicators.map((node) =>
    calculateNodeScore(node, leafScores)
  );

  const finalScore10 = round2(
    dimensions.reduce((sum, item) => {
      return sum + item.score * item.weight;
    }, 0)
  );

  const finalScore100 = round1(finalScore10 * 10);

  return {
    gameName: aiJson.gameName || requestedGameName,
    finalScore: finalScore100,
    finalScore10,
    dimensions,
    shortComment:
      aiJson.shortComment ||
      aiJson.comment ||
      "该评分由 AI 根据固定评分体系生成，仅供参考。",
    createdAt: new Date().toISOString(),
    model: OPENAI_MODEL
  };
}

function extractJsonFromText(text) {
  if (!text) {
    throw new Error("AI 返回内容为空");
  }

  let cleaned = String(text).trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");

    if (first !== -1 && last !== -1 && last > first) {
      const jsonLike = cleaned.slice(first, last + 1);
      return JSON.parse(jsonLike);
    }

    throw new Error("无法解析 AI 返回的 JSON");
  }
}

async function callAiForReview(gameName) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("缺少 DEEPSEEK_API_KEY，请在 .env 文件中配置");
  }

  const leafIndicators = getLeafIndicators();

  const systemPrompt = `
你是一名专业游戏商业化与游戏设计评测专家。
你需要根据用户输入的游戏名称，对该游戏进行评分。
评分范围是 1 到 10 分，可以使用一位小数。
必须严格按照用户给出的叶子指标逐项评分。
如果你无法确认某个信息，请基于公开常识和合理推断给出保守评分，不要编造具体数据。
最终只返回 JSON，不要返回 Markdown，不要返回解释性前后缀。
`;

  const userPrompt = `
请评价游戏：《${gameName}》。

评分体系说明：
- 所有叶子指标分数范围：1 到 10。
- 你只需要为每个叶子指标给出 score 和 reason。
- 后端会根据权重自动计算二级、一级和综合评分。
- 请给出一句简短评语 shortComment。

必须返回如下 JSON 结构：

{
  "gameName": "${gameName}",
  "shortComment": "一句中文简短评语",
  "leafScores": {
    "指标ID": {
      "score": 8.5,
      "reason": "简短原因"
    }
  }
}

必须覆盖以下所有叶子指标，不要遗漏：

${leafIndicators
  .map((item) => `- ${item.id}: ${item.name}`)
  .join("\n")}
`;

  const url = `${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.2,
      response_format: {
        type: "json_object"
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 调用失败：${response.status} ${errorText}`);
  }

  const data = await response.json();

  const content = data?.choices?.[0]?.message?.content;

  return extractJsonFromText(content);
}

app.get("/api/history", async (req, res) => {
  try {
    const reviews = await readReviews();

    const sorted = [...reviews].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      data: sorted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "读取历史记录失败"
    });
  }
});

app.post("/api/review", async (req, res) => {
  try {
    const gameName = String(req.body.gameName || "").trim();
    const force = Boolean(req.body.force);

    if (!gameName) {
      return res.status(400).json({
        success: false,
        message: "请输入游戏名称"
      });
    }

    const reviews = await readReviews();
    const normalized = normalizeGameName(gameName);

    const existing = reviews.find(
      (item) => normalizeGameName(item.gameName) === normalized
    );

    if (existing && !force) {
      return res.json({
        success: true,
        cached: true,
        data: existing
      });
    }

    const aiJson = await callAiForReview(gameName);
    const report = calculateReport(aiJson, gameName);

    const newReviews = reviews.filter(
      (item) => normalizeGameName(item.gameName) !== normalized
    );

    newReviews.push(report);

    await writeReviews(newReviews);

    res.json({
      success: true,
      cached: false,
      data: report
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message || "生成评分失败"
    });
  }
});

app.delete("/api/review/:gameName", async (req, res) => {
  try {
    const gameName = String(req.params.gameName || "").trim();

    if (!gameName) {
      return res.status(400).json({
        success: false,
        message: "请指定要删除的游戏名称"
      });
    }

    const reviews = await readReviews();
    const normalized = normalizeGameName(gameName);
    const filtered = reviews.filter(
      (item) => normalizeGameName(item.gameName) !== normalized
    );

    if (filtered.length === reviews.length) {
      return res.status(404).json({
        success: false,
        message: "未找到该游戏的评分记录"
      });
    }

    await writeReviews(filtered);

    res.json({
      success: true,
      message: `已删除《${gameName}》的评分记录`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "删除评分失败"
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ok"
  });
});

ensureDatabase().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    const { networkInterfaces } = require("os");
    const nets = networkInterfaces();
    let ip = "localhost";
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          ip = net.address;
          break;
        }
      }
      if (ip !== "localhost") break;
    }
    console.log(`游戏评分网站已启动：http://localhost:${PORT}`);
    console.log(`内网访问地址：http://${ip}:${PORT}`);
  });
});