require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const scoringSystem = require("./scoringSystem");

const app = express();

const PORT = process.env.PORT || 3000;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.deepseek.com";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "deepseek-v4-pro";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const EXPORT_TOKEN = process.env.EXPORT_TOKEN || "";

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "reviews.json");
const KNOWLEDGE_FILE = path.join(DATA_DIR, "knowledge.json");

const MAX_REVIEWS = 200;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "game rating", "public")));

async function ensureDatabase() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), "utf-8");
  }

  try {
    await fs.access(KNOWLEDGE_FILE);
  } catch {
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify({}, null, 2), "utf-8");
  }
}

async function readKnowledge() {
  await ensureDatabase();
  try {
    const content = await fs.readFile(KNOWLEDGE_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeKnowledge(knowledge) {
  await ensureDatabase();
  await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2), "utf-8");
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
  const trimmed = reviews.slice(-MAX_REVIEWS);
  await fs.writeFile(DB_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
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

function calculateReport(aiJson, requestedGameName, reference = {}) {
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
    developer: reference.developer || "",
    gameUrl: reference.gameUrl || "",
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

async function callAiForReview(gameName, reference = {}) {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("缺少 DEEPSEEK_API_KEY，请在 .env 文件中配置");
  }

  const leafIndicators = getLeafIndicators();

  const knowledge = await readKnowledge();
  const normalized = normalizeGameName(gameName);
  const existingKnowledge = knowledge[normalized] || null;
  const developer = String(reference.developer || "").trim().slice(0, 160);
  const gameUrl = String(reference.gameUrl || "").trim().slice(0, 2048);

  const knowledgeContext = existingKnowledge
    ? `\n我们已有的关于《${gameName}》的知识：\n${JSON.stringify(existingKnowledge, null, 2)}\n请基于这些已有知识，结合你的判断给出更准确的评分。\n`
    : "";

  const referenceContext =
    developer || gameUrl
      ? `
用户补充的参考信息如下，仅作为评估上下文。不要自动访问链接，也不要把未经证实的信息当作事实：
${developer ? `- 开发商：${developer}` : ""}
${gameUrl ? `- 游戏链接：${gameUrl}` : ""}
`
      : "";

  const systemPrompt = `
你是一名顶级的专业游戏商业化与游戏设计评测专家，拥有超过20年的游戏行业经验。
你需要根据用户输入的游戏名称，对该游戏进行全面、深度的评分分析。
评分体系包含四大维度：

1. 产品品质（权重35%）：评价游戏的基础制作质量，包括美术表现、音乐音效、操作交互、剧情题材。
2. 玩法设计（权重35%）：评价游戏好不好玩、耐不耐玩，包括玩法创新、玩法深度、可玩性、社交性、新手引导。
3. 市场定位（权重20%）：评价市场策略和用户匹配度，包括品类匹配度、目标受众、竞品差距、IP品牌价值、话题性。
4. 商业潜力（权重10%）：评价赚钱能力和长线运营前景，包括付费模式、付费深度、获客效率、长线运营。

评分范围是 1 到 10 分，可以使用一位小数。
必须严格按照用户给出的叶子指标逐项评分。
如果你无法确认某个信息，请基于公开常识和合理推断给出保守评分，不要编造具体数据。

对于 shortComment（简短评语），请写一段 150-300 字的深度分析，涵盖以下方面：
- 游戏的核心特色与创新点
- 目标用户群体和市场定位
- 与同类竞品相比的优劣势
- 商业变现潜力和长线运营前景
- 整体评价和推荐程度
要求语言犀利、深刻、有洞察力，避免套话和空话。

最终只返回 JSON，不要返回 Markdown，不要返回解释性前后缀。
`;

  const userPrompt = `${referenceContext}
请评价游戏：《${gameName}》。${knowledgeContext}

评分体系说明：
- 所有叶子指标分数范围：1 到 10。
- 你只需要为每个叶子指标给出 score 和 reason。
- 后端会根据权重自动计算二级、一级和综合评分。
- shortComment 要求 150-300 字深度分析评语。

必须返回如下 JSON 结构：

{
  "gameName": "${gameName}",
  "shortComment": "一段 150-300 字的深度中文评语",
  "gameKnowledge": {
    "genre": "游戏类型",
    "description": "游戏简介（100字以内）",
    "knownFacts": ["关键事实1", "关键事实2"]
  },
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

  const aiJson = extractJsonFromText(content);

  if (aiJson.gameKnowledge) {
    const allKnowledge = await readKnowledge();
    const key = normalizeGameName(gameName);
    allKnowledge[key] = {
      ...aiJson.gameKnowledge,
      updatedAt: new Date().toISOString()
    };
    await writeKnowledge(allKnowledge);
  }

  return aiJson;
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
    const developer = String(req.body.developer || "").trim().slice(0, 160);
    const gameUrl = String(req.body.gameUrl || "").trim().slice(0, 2048);

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

    if (existing && !force && !developer && !gameUrl) {
      return res.json({
        success: true,
        cached: true,
        data: existing
      });
    }

    const reference = { developer, gameUrl };
    const aiJson = await callAiForReview(gameName, reference);
    const report = calculateReport(aiJson, gameName, reference);

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

app.get("/api/knowledge", async (req, res) => {
  try {
    const knowledge = await readKnowledge();
    res.json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "读取知识库失败"
    });
  }
});

app.post("/api/knowledge", async (req, res) => {
  try {
    const { gameName, genre, description, knownFacts } = req.body;

    if (!gameName || !gameName.trim()) {
      return res.status(400).json({
        success: false,
        message: "请输入游戏名称"
      });
    }

    const allKnowledge = await readKnowledge();
    const key = normalizeGameName(gameName);

    allKnowledge[key] = {
      genre: genre || "",
      description: description || "",
      knownFacts: knownFacts || [],
      updatedAt: new Date().toISOString()
    };

    await writeKnowledge(allKnowledge);

    res.json({
      success: true,
      message: `已保存《${gameName}》的知识`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "保存知识失败"
    });
  }
});

app.delete("/api/knowledge/:gameName", async (req, res) => {
  try {
    const gameName = String(req.params.gameName || "").trim();
    if (!gameName) {
      return res.status(400).json({ success: false, message: "请指定游戏名称" });
    }

    const allKnowledge = await readKnowledge();
    const key = normalizeGameName(gameName);

    if (!allKnowledge[key]) {
      return res.status(404).json({ success: false, message: "未找到该游戏的知识" });
    }

    delete allKnowledge[key];
    await writeKnowledge(allKnowledge);

    res.json({ success: true, message: `已删除《${gameName}》的知识` });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "删除知识失败"
    });
  }
});

app.get("/api/export", async (req, res) => {
  try {
    const token = String(req.query.token || "").trim();

    if (EXPORT_TOKEN && token !== EXPORT_TOKEN) {
      return res.status(403).json({
        success: false,
        message: "导出密码错误，无权操作"
      });
    }

    const reviews = await readReviews();
    const knowledge = await readKnowledge();

    const exportData = {
      exportedAt: new Date().toISOString(),
      totalReviews: reviews.length,
      totalKnowledge: Object.keys(knowledge).length,
      reviews,
      knowledge
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="game-rating-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "导出数据失败"
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
