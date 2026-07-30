# Cloudflare 部署指南

本项目已提供 Cloudflare Worker、D1 表结构和静态资源配置。云端运行时使用 `src/worker.js`，不依赖 Express 或本地 JSON 文件；原来的 `server.js` 仅保留为本地旧版本运行方式。

## 1. 创建 D1 数据库

```powershell
npm install
npm run cf:db:create
```

命令会输出一个 D1 `database_id`。将它填入 `wrangler.toml` 的 `database_id`，替换全零占位值。

## 2. 应用数据库结构

```powershell
npm run cf:db:migrate
```

这会在远端 D1 创建 `reviews` 和 `game_knowledge` 表及其查询索引。

## 3. 配置生产密钥

以下值只保存在 Cloudflare，不会进入 Git 仓库：

```powershell
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put EXPORT_TOKEN
```

`EXPORT_TOKEN` 建议设置为强随机值。`OPENAI_BASE_URL`、`OPENAI_MODEL` 和 `MAX_REVIEWS` 是非敏感变量，已写入 `wrangler.toml`，可按需修改。

本地调试时，在 `.dev.vars` 创建同名键值；该文件已被 Git 忽略：

```text
DEEPSEEK_API_KEY=your_api_key
EXPORT_TOKEN=your_export_password
```

## 4. 导入旧 JSON 数据（可选）

如果 `data/reviews.json` 与 `data/knowledge.json` 有需要保留的数据：

```powershell
node scripts/create-d1-import.mjs
npx wrangler d1 execute game-rating-db --remote --file .tmp/d1-import.sql
```

导入脚本会生成已忽略的 `.tmp/d1-import.sql`。脚本使用按游戏名称覆盖的 upsert，重复执行不会产生重复记录。导入完成后，先通过导出接口确认数据，再决定是否归档旧 JSON 文件。

## 5. 本地验证与部署

```powershell
npm run cf:dev
npm run cf:deploy
```

`npm run cf:dev` 使用本地 D1；首次本地运行前执行：

```powershell
npx wrangler d1 migrations apply game-rating-db --local
```

部署后，静态前端由 Worker Assets 提供，`/api/*` 由同一个 Worker 处理，数据库通过 D1 binding 访问。

## 容量与安全边界

按每周约 20 条评分计算，一年约 1,040 条记录。即使单条完整评分 JSON 为 50KB，年增长量也约为 51MB，远低于 D1 Free 的 5GB 总存储额度。评分、知识库更新和历史查询的预计行读写量同样远低于免费层的日限额。

模型调用才是主要成本和滥用风险。公开部署前应至少接入 Turnstile，并在 Worker 增加基于 IP 的限流；限流计数可使用 KV，D1 仍应作为评分与知识库的唯一事实来源。
