# LiveCanvas Builder Local Cloudflare Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. `.cst/events.jsonl` is the only task state; this document is the immutable task contract, not a mutable checklist.

**Goal:** 在不创建线上 Cloudflare 资源的前提下，把项目重构为可由 TanStack Start 在 Cloudflare Workers 运行，并在本地完成 D1、R2、Workflows 与生产数据副本的闭环验证。

**Architecture:** TanStack Start Worker 承载 SSR、API 和静态资源；Better Auth 与业务数据使用 D1；媒体使用 R2；长任务使用 Workflows，应用任务状态保存在 D1。生产数据只读导出到 Git 忽略目录，经确定性转换后导入本地绑定。

**Tech Stack:** Bun, TypeScript, React 19, TanStack Start/Router, Vite, Cloudflare Workers/D1/R2/Workflows, Better Auth, Drizzle ORM, Vitest/Bun Test, Playwright.

---

## Task 1: Repository Governance And Frozen Contract

**Owned paths:** `.gitignore`, `.env.example`, `.dev.vars.example`, `docs/`, `.cst/`

1. 提交 `.env.prod`、`.migration/private/`、`.wrangler/` 和 CST lock 的忽略规则；验证 `.env.prod` 未被跟踪。
2. 提交总计划、任务计划和 AIHubMix 汇总报告。
3. 冻结当前页面/API 清单、生产数据统计与媒体 manifest 格式，避免实现同时修改验收事实。
4. 记录当前基线：28 tests pass、typecheck pass、Biome pass、旧 Next build 的环境契约失败。

**Acceptance:**

```bash
git check-ignore .env.prod .migration/private/probe .wrangler/probe .cst/events.lock
test -z "$(git ls-files '.env.prod' '.migration/private/**')"
test -f docs/cloudflare-migration-plan.md
test -f docs/cloudflare-migration-tasks.md
test -f docs/aihubmix-model-catalog.md
```

## Task 2: TanStack Start Worker Foundation

**Owned paths:** `package.json`, `bun.lock`, `vite.config.ts`, `wrangler.jsonc`, `tsconfig.json`, `src/router.tsx`, `src/routeTree.gen.ts`, `src/routes/`, `src/server.ts`

1. 先写路由 manifest 和 Worker binding 类型测试，确认旧 URL 集合与目标绑定名称。
2. 移除 Next/Trigger/Vercel runtime 依赖，加入 TanStack Start、Cloudflare Vite plugin、Wrangler、Better Auth 与 D1/R2 类型。
3. 建立 `__root`、公开路由、protected pathless layout、API server routes 和自定义 Worker entrypoint。
4. 配置纯本地 bindings；`wrangler.jsonc` 不包含远程 database/bucket ID，不执行 deploy。
5. 让 `bun run dev`、`bun run build`、`bun run typecheck` 和 `wrangler deploy --dry-run` 可执行。

**Acceptance:**

```bash
bun test src/routes/__tests__/route-manifest.test.ts
bun run typecheck
bun run build
bunx wrangler deploy --dry-run
```

## Task 3: D1 Schema And Data Access Invariants

**Owned paths:** `src/server/db/`, `drizzle.config.ts`, `migrations/`, `src/server/repositories/`

1. 先写 SQLite schema 测试：主键、外键、cascade、唯一约束、时间/布尔映射和 generation task 终态约束。
2. 建立 Better Auth 与业务 D1 schema；保留原 user/project/account ID。
3. 把 gallery/profile/project 查询拆到以 Session userId 为边界的 repositories。
4. 使用 D1 batch 原子实现 purchase/favorite toggle；测试并发重复操作不会产生重复行或计数漂移。
5. 删除 Next cache-tag 层；用户数据不缓存，公开图库直接查询当前 D1 状态。

**Acceptance:**

```bash
bun test src/server/db src/server/repositories
bunx wrangler d1 migrations apply DB --local
bun run typecheck
```

## Task 4: Better Auth And Route Authorization

**Owned paths:** `src/server/auth/`, `src/routes/api/auth/`, `src/routes/_protected*`, `src/components/login-form.tsx`, `src/components/nav/`

1. 先写 Session、未登录重定向、已登录公开页重定向和资源越权测试。
2. 配置 Better Auth D1 adapter、Google/Discord providers、TanStack cookies 和 `/api/auth/$` handler。
3. 保持现有登录/退出 UI，只替换调用边界；不新增 GitHub 按钮。
4. 将 Session 注入 TanStack request context；所有 server function 从 context 读取 userId，不接受客户端传入 owner。
5. 测试用户、OAuth account 迁移映射，明确旧 Session 不导入。

**Acceptance:**

```bash
bun test src/server/auth src/routes/api/auth src/routes/__tests__/authorization.test.ts
bun run typecheck
```

## Task 5: Private Production Snapshot And D1 Conversion

**Owned paths:** `scripts/migration/`, `src/migration/`, `src/migration/__tests__/`

1. 用不含 PII 的 fixture 先写 PostgreSQL row -> D1 row 转换测试，覆盖 account 字段、UTC 时间、布尔、null、HTML 和特殊字符。
2. 实现只读 snapshot CLI：输出 custom dump、逐表 JSON、统计与 SHA-256 manifest 到 `.migration/private/`。
3. 实现 D1 SQL 生成器；不导入旧 Session，不重算 purchaseCount，不改变 ID。
4. 实现源/目标验证器：行数、主键集合、外键、规范化 hash 与 5 个既有 purchaseCount 差异。
5. 执行生产只读 snapshot，并在本地 D1 导入后运行验证器；任何生产内容不得写入 stdout 或 CST evidence。

**Acceptance:**

```bash
bun test src/migration
bun run migration:snapshot -- --env .env.prod --output .migration/private
bun run migration:import-local -- --input .migration/private
bun run migration:verify-local -- --input .migration/private
```

## Task 6: Vercel Blob Archive And Local R2 Migration

**Owned paths:** `src/server/storage/`, `scripts/migration/media.ts`, `src/migration/__tests__/media.test.ts`

1. 先写 URL -> R2 key、MIME、manifest、去重和哈希测试。
2. 实现全量 589 Blob 下载归档和 metadata manifest；支持中断后按 size/hash 跳过已完成对象。
3. 只把 446 个数据库引用 Blob 与 8 个 Bunny 文件导入本地 R2；143 个孤儿只归档。
4. 实现 R2 上传、头像替换、缩略图写入和删除 adapter；第三方 Google/Discord/Unsplash URL 保持原值。
5. 验证本地 R2 454 个对象全部可读且 SHA-256 匹配，D1 URL 映射零缺失。

**Acceptance:**

```bash
bun test src/server/storage src/migration/__tests__/media.test.ts
bun run migration:archive-media -- --env .env.prod --output .migration/private
bun run migration:import-media-local -- --input .migration/private
bun run migration:verify-media-local -- --input .migration/private
```

## Task 7: AIHubMix Catalog Single Source Of Truth

**Owned paths:** `src/lib/aihubmix/`, `src/routes/api/models/`, `src/features/dashboard/model-catalog/`

1. 按 `docs/aihubmix-model-catalog.md` 先恢复模型标准化、过滤、精选、显示名、推荐顺序和错误测试。
2. 实现 `/api/models/aihubmix`，只转发用户 Authorization，响应 `no-store`，日志不含 key。
3. 建立唯一 ModelCatalog provider，供选择器、默认值、费用显示和提交校验共用。
4. 删除 Edge Config、静态多 provider 列表和服务端共享 AIHubMix/OpenRouter key 依赖。
5. 验证鼠标和快捷键使用同一 submit readiness 条件。

**Acceptance:**

```bash
bun test src/lib/aihubmix src/features/dashboard/model-catalog
bun run typecheck
```

## Task 8: Workflow Task Algebra And Encryption

**Owned paths:** `src/server/tasks/`, `src/workflows/`, `src/routes/api/task/`, `src/types/task.ts`

1. 先写任务状态机、终态竞争、owner 校验、取消和 AES-GCM round-trip/redaction 测试。
2. 定义应用任务状态 `PENDING/RUNNING/COMPLETED/FAILED/CANCELED` 和稳定 wire contract。
3. submit 校验 Session、模型和输入，写 D1 task，再把加密 payload 交给 Workflow。
4. Workflow 解密后调用 AIHubMix，写 usage/result；条件更新保证 completed 与 canceled 只有一方生效。
5. status 只读 owner 的 D1 task；cancel 先条件更新 D1，再终止 Workflow。
6. 使用本地 Workflow/AI stub 验证成功、失败、取消；随后以用户 BYOK 做一次真实 AIHubMix 本地闭环。

**Acceptance:**

```bash
bun test src/server/tasks src/workflows src/routes/api/task
bun run test:task-e2e:local
```

## Task 9: Port Remaining Routes Without UI Change

**Owned paths:** `src/routes/`, `src/features/`, `src/components/`, `src/styles/`, `public/`

1. 为旧 route manifest 建立逐路由 contract tests，先覆盖 response status、redirect 和关键文案。
2. 迁移 dashboard、chat、wizard、preview、gallery、profile、legal、root/example 页面。
3. 把 Server Actions 改为 TanStack server functions；保留输入输出与 toast/redirect 行为。
4. 替换 Next Link/Image/Navigation/Font/Metadata；固定图片尺寸并保持现有 CSS class 和布局。
5. 迁移 `/api/chat` streaming、`/api/metadata`、preview screenshot、publish/edit/delete、favorite/purchase、avatar。

**Acceptance:**

```bash
bun test src/routes src/features
bun run typecheck
bun run build
```

## Task 10: Local Visual And Functional Closure

**Owned paths:** `tests/e2e/`, `playwright.config.ts`, `scripts/verify-local.ts`, `docs/local-validation-report.md`

1. 用固定 fixture 捕获旧 Vercel 与本地 TanStack 的 1440x900、390x844 页面基线。
2. Playwright 覆盖登录态、dashboard、模型刷新、submit/poll/cancel、chat、preview、publish、gallery、favorite/purchase、profile/avatar。
3. 检查 console error、失败网络请求、文本溢出、元素重叠、非空 iframe/canvas 和 localStorage 保持。
4. 启动唯一 `wrangler dev` 服务；记录 URL、PID、测试命令、结果与截图，不启动重复服务。
5. 生成 `docs/local-validation-report.md`，只记录统计、命令、哈希和已知风险，不包含生产数据或秘密。

**Acceptance:**

```bash
bun test
bun run typecheck
bun run check
bun run build
bunx wrangler deploy --dry-run
bun run test:e2e
bun run verify:local
```

## Task 11: Final Self Review And User Handoff

**Owned mode:** no diff

1. 以 invariant violation、duplicated state、boundary leakage、semantic inconsistency、unverifiable claim 顺序审查完整 diff。
2. 核对 Git 中无 `.env.prod`、迁移数据、token、用户邮箱、数据库 URL 或媒体二进制。
3. 运行全部验收并通过 CST acceptance 完成所有本地任务。
4. 保持本地 dev server 运行，向用户汇报 URL、验证证据和剩余风险。
5. 不创建线上 Cloudflare 资源；用户验收后再创建独立发布任务树。

**Acceptance:** self review evidence plus `cst next` returning `phase=no-op` with no claims.
