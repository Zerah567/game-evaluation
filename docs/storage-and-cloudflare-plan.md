# 数据存储与 Cloudflare 部署方案

## 当前状态

应用目前将评分记录和游戏知识写入 `data/reviews.json`、`data/knowledge.json`。这种方式适合单机试用，但不适合生产环境：多个请求可能互相覆盖，查询和更新都需要读写完整文件，也无法被 Cloudflare Workers 访问。

## 推荐的数据层：Cloudflare D1

生产环境建议使用 Cloudflare D1 作为评分记录和知识库的主存储。它是托管 SQLite，适合当前这种以小型结构化数据、按游戏名称检索、按时间排序为主的工作负载。

建议的核心表：

```sql
CREATE TABLE game_knowledge (
  game_key TEXT PRIMARY KEY,
  game_name TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  known_facts_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_key TEXT NOT NULL,
  game_name TEXT NOT NULL,
  developer TEXT NOT NULL DEFAULT '',
  game_url TEXT NOT NULL DEFAULT '',
  final_score REAL NOT NULL,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  model TEXT NOT NULL
);

CREATE INDEX reviews_created_at_idx ON reviews(created_at DESC);
CREATE INDEX reviews_game_key_idx ON reviews(game_key);
```

`report_json` 用于保存完整的多层评分结果，`final_score`、`game_key` 和 `created_at` 保持独立列，以支持列表、排序与后续统计。知识库中的 `known_facts_json` 保留为 JSON 字符串，可以避免在当前规模下过度拆表。

不建议把 KV 用作主知识库：它适合缓存、限流计数和短期状态，但不适合历史记录排序、模糊查询或需要稳定查询语义的数据。R2 也更适合导出文件和大对象，并非该场景的主数据库。

## 迁移步骤

1. 为现有的读写函数增加 `Storage` 接口，先保持 JSON 文件实现以便本地回归。
2. 新增 D1 实现，逐步替换历史、知识库和导出接口。
3. 编写一次性导入脚本，将两个 JSON 文件数据导入 D1；导入完成后 JSON 文件仅作为备份。
4. 在开发环境使用 Wrangler 的本地 D1，在生产环境通过 D1 binding 注入数据库。

## Cloudflare 免费部署评估

可以在低到中等使用量下免费部署，但当前版本不能直接部署到 Cloudflare。原因是它依赖 Express、Node 文件系统和本地 JSON 文件，而 Workers 运行时没有可持久化的本地文件系统。

目标结构如下：

```text
浏览器静态资源
        |
Cloudflare Worker（/api）
   |                |
  D1         DeepSeek 兼容 API
```

前端静态文件可以作为 Worker 静态资源或 Cloudflare Pages 托管；`/api/*` 应改写为 Worker 路由或 Pages Functions。`DEEPSEEK_API_KEY`、导出令牌必须配置为 Cloudflare Secret，不能进入前端或仓库。

截至 2026-07-30，Cloudflare 官方文档列出的 Workers Free 限额为每天 100,000 次动态 Worker 请求、每次调用 10ms CPU 时间；静态资源请求免费且不限量。D1 Free 为每天 500 万行读取、10 万行写入和总计 5GB 存储。对当前以单次评分、少量历史查询为主的产品，这些额度足以支持早期试用和小规模公开测试。

评分一次会产生一次外部模型调用，模型费用由 API 提供商承担，不包含在 Cloudflare 免费资源内。Workers 的 10ms CPU 限制意味着 Worker 应只做轻量的请求校验、D1 查询和 JSON 转换；等待 DeepSeek 响应的网络时间不应在 Worker 内执行复杂计算。上线前仍应在 Cloudflare 控制台核对套餐是否有变动。

上线前至少应补充：

- Turnstile 或登录机制，防止公开评分接口被滥用并消耗模型额度。
- 基于 IP 的限流，可用 KV 保存短期计数。
- Worker 请求超时与 API 错误的统一处理。
- D1 的定期导出备份；现有导出接口可保留为管理员工具。

## 非阻塞清理项

`xlsx` 已在依赖中声明但当前未被代码使用。若近期不提供 Excel 导出，可在后续依赖整理时移除；若需要 Excel 导出，则应由服务端显式使用它生成文件。
