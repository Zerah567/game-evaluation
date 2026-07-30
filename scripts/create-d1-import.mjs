import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reviewsPath = path.join(root, "data", "reviews.json");
const knowledgePath = path.join(root, "data", "knowledge.json");
const outputDir = path.join(root, ".tmp");
const outputPath = path.join(outputDir, "d1-import.sql");

function normalizeGameName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sqlText(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function sqlNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(fallback);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

const [reviews, knowledge] = await Promise.all([
  readJson(reviewsPath, []),
  readJson(knowledgePath, {})
]);

if (!Array.isArray(reviews) || !knowledge || typeof knowledge !== "object") {
  throw new Error("data/reviews.json 或 data/knowledge.json 的格式不正确。");
}

const statements = ["BEGIN TRANSACTION;"];

for (const report of reviews) {
  const gameName = String(report.gameName || "").trim();
  const gameKey = normalizeGameName(gameName);
  if (!gameKey) continue;

  statements.push(`INSERT INTO reviews
  (game_key, game_name, developer, game_url, final_score, final_score10, report_json, model, created_at)
 VALUES (${sqlText(gameKey)}, ${sqlText(gameName)}, ${sqlText(report.developer)}, ${sqlText(report.gameUrl)}, ${sqlNumber(report.finalScore)}, ${sqlNumber(report.finalScore10)}, ${sqlText(JSON.stringify(report))}, ${sqlText(report.model)}, ${sqlText(report.createdAt || new Date().toISOString())})
 ON CONFLICT(game_key) DO UPDATE SET
  game_name = excluded.game_name,
  developer = excluded.developer,
  game_url = excluded.game_url,
  final_score = excluded.final_score,
  final_score10 = excluded.final_score10,
  report_json = excluded.report_json,
  model = excluded.model,
  created_at = excluded.created_at;`);
}

for (const [key, value] of Object.entries(knowledge)) {
  const entry = value && typeof value === "object" ? value : {};
  const gameName = String(entry.gameName || key).trim();
  const gameKey = normalizeGameName(gameName);
  if (!gameKey) continue;

  const knownFacts = Array.isArray(entry.knownFacts) ? entry.knownFacts : [];
  statements.push(`INSERT INTO game_knowledge
  (game_key, game_name, genre, description, known_facts_json, updated_at)
 VALUES (${sqlText(gameKey)}, ${sqlText(gameName)}, ${sqlText(entry.genre)}, ${sqlText(entry.description)}, ${sqlText(JSON.stringify(knownFacts))}, ${sqlText(entry.updatedAt || new Date().toISOString())})
 ON CONFLICT(game_key) DO UPDATE SET
  game_name = excluded.game_name,
  genre = excluded.genre,
  description = excluded.description,
  known_facts_json = excluded.known_facts_json,
  updated_at = excluded.updated_at;`);
}

statements.push("COMMIT;");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${statements.join("\n\n")}\n`, "utf8");

console.log(`已生成 ${outputPath}`);
console.log(`待导入评分记录：${reviews.length} 条；知识库条目：${Object.keys(knowledge).length} 条。`);
