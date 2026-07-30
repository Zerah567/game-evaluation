import scoringSystem from "../scoringSystem.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_GAME_NAME_LENGTH = 160;
const MAX_DEVELOPER_LENGTH = 160;
const MAX_GAME_URL_LENGTH = 2048;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

function normalizeGameName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function trimText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function round1(num) {
  return Math.round(Number(num) * 10) / 10;
}

function round2(num) {
  return Math.round(Number(num) * 100) / 100;
}

function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 5;
  return Math.min(10, Math.max(1, number));
}

async function readJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "请求内容过大");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new HttpError(413, "请求内容过大");
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "请求格式必须为 JSON");
  }
}

function getLeafIndicators(nodes = scoringSystem.indicators) {
  const leaves = [];

  function walk(node) {
    if (!node.children || node.children.length === 0) {
      leaves.push({ id: node.id, name: node.name });
      return;
    }
    node.children.forEach(walk);
  }

  nodes.forEach(walk);
  return leaves;
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
      reason: trimText(reason, 500)
    };
  }

  const children = node.children.map((child) =>
    calculateNodeScore(child, leafScores)
  );
  const score = round1(
    children.reduce((sum, child) => sum + child.score * child.weight, 0)
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

function calculateReport(aiJson, requestedGameName, reference, model) {
  const dimensions = scoringSystem.indicators.map((node) =>
    calculateNodeScore(node, aiJson.leafScores || aiJson.scores || {})
  );
  const finalScore10 = round2(
    dimensions.reduce((sum, item) => sum + item.score * item.weight, 0)
  );

  return {
    gameName: trimText(aiJson.gameName, MAX_GAME_NAME_LENGTH) || requestedGameName,
    finalScore: round1(finalScore10 * 10),
    finalScore10,
    dimensions,
    shortComment:
      trimText(aiJson.shortComment || aiJson.comment, 2000) ||
      "该评分由 AI 根据固定评分体系生成，仅供参考。",
    developer: reference.developer,
    gameUrl: reference.gameUrl,
    createdAt: new Date().toISOString(),
    model
  };
}

function extractJsonFromText(text) {
  if (!text) throw new HttpError(502, "AI 返回内容为空");

  const cleaned = String(text)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch {
        // Fall through to the normalized API error below.
      }
    }
    throw new HttpError(502, "无法解析 AI 返回的 JSON");
  }
}

function normalizeKnowledge(gameName, input) {
  const knownFacts = Array.isArray(input.knownFacts)
    ? input.knownFacts
        .map((fact) => trimText(fact, 300))
        .filter(Boolean)
        .slice(0, 50)
    : [];

  return {
    gameName,
    genre: trimText(input.genre, 120),
    description: trimText(input.description, 1000),
    knownFacts,
    updatedAt: new Date().toISOString()
  };
}

async function getKnowledge(env, gameKey) {
  const row = await env.DB.prepare(
    "SELECT game_name, genre, description, known_facts_json, updated_at FROM game_knowledge WHERE game_key = ?"
  )
    .bind(gameKey)
    .first();

  if (!row) return null;
  let knownFacts = [];
  try {
    knownFacts = JSON.parse(row.known_facts_json || "[]");
  } catch {
    knownFacts = [];
  }

  return {
    gameName: row.game_name,
    genre: row.genre,
    description: row.description,
    knownFacts,
    updatedAt: row.updated_at
  };
}

async function saveKnowledge(env, gameName, input) {
  const gameKey = normalizeGameName(gameName);
  const knowledge = normalizeKnowledge(gameName, input);
  await env.DB.prepare(
    `INSERT INTO game_knowledge
      (game_key, game_name, genre, description, known_facts_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_key) DO UPDATE SET
       game_name = excluded.game_name,
       genre = excluded.genre,
       description = excluded.description,
       known_facts_json = excluded.known_facts_json,
       updated_at = excluded.updated_at`
  )
    .bind(
      gameKey,
      knowledge.gameName,
      knowledge.genre,
      knowledge.description,
      JSON.stringify(knowledge.knownFacts),
      knowledge.updatedAt
    )
    .run();
  return knowledge;
}

async function readKnowledge(env) {
  const { results = [] } = await env.DB.prepare(
    "SELECT game_key, game_name, genre, description, known_facts_json, updated_at FROM game_knowledge ORDER BY updated_at DESC"
  ).all();

  return Object.fromEntries(
    results.map((row) => {
      let knownFacts = [];
      try {
        knownFacts = JSON.parse(row.known_facts_json || "[]");
      } catch {
        knownFacts = [];
      }
      return [
        row.game_key,
        {
          gameName: row.game_name,
          genre: row.genre,
          description: row.description,
          knownFacts,
          updatedAt: row.updated_at
        }
      ];
    })
  );
}

async function getReview(env, gameKey) {
  const row = await env.DB.prepare(
    "SELECT report_json FROM reviews WHERE game_key = ?"
  )
    .bind(gameKey)
    .first();
  if (!row) return null;
  try {
    return JSON.parse(row.report_json);
  } catch {
    return null;
  }
}

async function readReviews(env, maxReviews) {
  const { results = [] } = await env.DB.prepare(
    "SELECT report_json FROM reviews ORDER BY created_at DESC LIMIT ?"
  )
    .bind(maxReviews)
    .all();

  return results.flatMap((row) => {
    try {
      return [JSON.parse(row.report_json)];
    } catch {
      return [];
    }
  });
}

async function saveReview(env, report, gameKey = normalizeGameName(report.gameName)) {
  await env.DB.prepare(
    `INSERT INTO reviews
      (game_key, game_name, developer, game_url, final_score, final_score10, report_json, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_key) DO UPDATE SET
       game_name = excluded.game_name,
       developer = excluded.developer,
       game_url = excluded.game_url,
       final_score = excluded.final_score,
       final_score10 = excluded.final_score10,
       report_json = excluded.report_json,
       model = excluded.model,
       created_at = excluded.created_at`
  )
    .bind(
      gameKey,
      report.gameName,
      report.developer,
      report.gameUrl,
      report.finalScore,
      report.finalScore10,
      JSON.stringify(report),
      report.model,
      report.createdAt
    )
    .run();
}

async function callAiForReview(env, gameName, reference, knowledge) {
  if (!env.DEEPSEEK_API_KEY) {
    throw new HttpError(500, "缺少 DEEPSEEK_API_KEY 密钥配置");
  }

  const leafIndicators = getLeafIndicators();
  const knowledgeContext = knowledge
    ? `\n已有知识：\n${JSON.stringify(knowledge, null, 2)}\n请基于已有知识与公开常识进行判断。\n`
    : "";
  const referenceContext =
    reference.developer || reference.gameUrl
      ? `\n用户补充的参考信息如下，仅作为评估上下文。不要自动访问链接，也不要把未经证实的信息当作事实：\n${reference.developer ? `- 开发商：${reference.developer}\n` : ""}${reference.gameUrl ? `- 游戏链接：${reference.gameUrl}\n` : ""}`
      : "";

  const systemPrompt = `你是一名专业的游戏商业化与游戏设计评测专家。请以产品品质、玩法设计、市场定位和商业潜力为框架进行分析。评分范围为 1 到 10，可使用一位小数。信息不确定时请使用保守判断，绝不编造具体数据。最终只返回 JSON，不要返回 Markdown 或解释性文字。`;
  const userPrompt = `${referenceContext}\n请评价游戏：《${gameName}》。${knowledgeContext}\n所有叶子指标均须评分：\n${leafIndicators.map((item) => `- ${item.id}: ${item.name}`).join("\n")}\n\n返回严格符合以下结构的 JSON：\n{\n  "gameName": "${gameName}",\n  "shortComment": "150-300 字的中文深度评语",\n  "gameKnowledge": { "genre": "类型", "description": "100字以内简介", "knownFacts": ["关键事实"] },\n  "leafScores": { "指标ID": { "score": 8.5, "reason": "简短理由" } }\n}`;
  const baseUrl = (env.OPENAI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "deepseek-v4-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new HttpError(502, `AI API 调用失败：${response.status}`);
  }

  const data = await response.json();
  return extractJsonFromText(data?.choices?.[0]?.message?.content);
}

function maxReviews(env) {
  const value = Number(env.MAX_REVIEWS || 200);
  return Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 1), 1000) : 200;
}

async function handleApi(request, env, url) {
  const { pathname } = url;

  if (request.method === "GET" && pathname === "/api/health") {
    await env.DB.prepare("SELECT 1").first();
    return json({ success: true, message: "ok", storage: "d1" });
  }

  if (request.method === "GET" && pathname === "/api/history") {
    return json({ success: true, data: await readReviews(env, maxReviews(env)) });
  }

  if (request.method === "POST" && pathname === "/api/review") {
    const body = await readJson(request);
    const gameName = trimText(body.gameName, MAX_GAME_NAME_LENGTH);
    if (!gameName) throw new HttpError(400, "请输入游戏名称");

    const reference = {
      developer: trimText(body.developer, MAX_DEVELOPER_LENGTH),
      gameUrl: trimText(body.gameUrl, MAX_GAME_URL_LENGTH)
    };
    const gameKey = normalizeGameName(gameName);
    const existing = await getReview(env, gameKey);
    if (existing && !body.force && !reference.developer && !reference.gameUrl) {
      return json({ success: true, cached: true, data: existing });
    }

    const knowledge = await getKnowledge(env, gameKey);
    const aiJson = await callAiForReview(env, gameName, reference, knowledge);
    const report = calculateReport(aiJson, gameName, reference, env.OPENAI_MODEL || "deepseek-v4-flash");

    await saveReview(env, report, gameKey);
    if (aiJson.gameKnowledge && typeof aiJson.gameKnowledge === "object") {
      await saveKnowledge(env, gameName, aiJson.gameKnowledge);
    }

    return json({ success: true, cached: false, data: report });
  }

  if (request.method === "GET" && pathname === "/api/knowledge") {
    return json({ success: true, data: await readKnowledge(env) });
  }

  if (request.method === "POST" && pathname === "/api/knowledge") {
    const body = await readJson(request);
    const gameName = trimText(body.gameName, MAX_GAME_NAME_LENGTH);
    if (!gameName) throw new HttpError(400, "请输入游戏名称");
    await saveKnowledge(env, gameName, body);
    return json({ success: true, message: `已保存《${gameName}》的知识` });
  }

  if (request.method === "GET" && pathname === "/api/export") {
    const token = trimText(url.searchParams.get("token"), 512);
    if (env.EXPORT_TOKEN && token !== env.EXPORT_TOKEN) {
      throw new HttpError(403, "导出密码错误，无权操作");
    }
    const reviews = await readReviews(env, maxReviews(env));
    const knowledge = await readKnowledge(env);
    const content = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalReviews: reviews.length,
        totalKnowledge: Object.keys(knowledge).length,
        reviews,
        knowledge
      },
      null,
      2
    );
    return new Response(content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="game-rating-export-${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  }

  const reviewPrefix = "/api/review/";
  if (request.method === "DELETE" && pathname.startsWith(reviewPrefix)) {
    const gameName = trimText(decodeURIComponent(pathname.slice(reviewPrefix.length)), MAX_GAME_NAME_LENGTH);
    if (!gameName) throw new HttpError(400, "请指定要删除的游戏名称");
    const result = await env.DB.prepare("DELETE FROM reviews WHERE game_key = ?")
      .bind(normalizeGameName(gameName))
      .run();
    if (!result.meta.changes) throw new HttpError(404, "未找到该游戏的评分记录");
    return json({ success: true, message: `已删除《${gameName}》的评分记录` });
  }

  const knowledgePrefix = "/api/knowledge/";
  if (request.method === "DELETE" && pathname.startsWith(knowledgePrefix)) {
    const gameName = trimText(decodeURIComponent(pathname.slice(knowledgePrefix.length)), MAX_GAME_NAME_LENGTH);
    if (!gameName) throw new HttpError(400, "请指定游戏名称");
    const result = await env.DB.prepare("DELETE FROM game_knowledge WHERE game_key = ?")
      .bind(normalizeGameName(gameName))
      .run();
    if (!result.meta.changes) throw new HttpError(404, "未找到该游戏的知识");
    return json({ success: true, message: `已删除《${gameName}》的知识` });
  }

  throw new HttpError(404, "接口不存在");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ success: false, message: error.message }, error.status);
      }
      console.error(error);
      return json({ success: false, message: "服务暂时不可用，请稍后重试" }, 500);
    }
  }
};
