# LiveCanvas Builder Cloudflare 迁移总计划

## 1. 目标与边界

### 稳定轴

- 所有现有页面 URL、DOM 结构、样式、文案和交互保持不变。
- Google/Discord 登录、AIHubMix BYOK、模型选择、生成/轮询/取消、流式 ACF/LNL 对话、元数据生成、预览、发布、图库、收藏、购买和个人中心行为保持不变。
- `aihubmix_api_key`、`dialogue-storage`、`theme-store` 继续保存在浏览器 localStorage；正式域名仍为 `lc.xunpanziyou.com`。

### 变化轴

- Next.js 迁移到 TanStack Start。
- PostgreSQL 迁移到 Cloudflare D1。
- Vercel Blob 与项目拥有的 Bunny 文件迁移到 R2。
- Trigger.dev v3 迁移到 Cloudflare Workflows。
- Vercel 运行时迁移到 Cloudflare Workers。

### 不变量

- 同一用户操作必须产生相同的可见结果。
- 受保护页面和写操作必须验证真实 Session，不能只判断 Cookie 是否存在。
- D1 中的应用任务状态和结果是唯一事实源，Workflow 只负责执行。
- 数据库中的媒体引用必须指向存在且哈希匹配的对象。
- 用户 API Key、OAuth token、Session token、生产数据库凭证不得进入 Git、日志或明文任务状态。

## 2. 当前已确认事实

- 当前重构分支：`refactor/tanstack-start-cloudflare`，基线为 `main`。
- `docs/aihubmix-model-catalog.md` 是 AIHubMix 模型目录改造规范；已删除分支的代码不作为实现来源。
- 当前 `main`：28 项测试、TypeScript、Biome 通过；无生产环境变量时 Next build 因旧环境契约失败。
- 生产数据库为 Neon PostgreSQL：865 users、865 accounts、1988 sessions、482 projects、196 favorites、140 purchases，约 6.2 MB。
- 当前有 22 个有效 Session；鉴权迁移后统一重新登录。
- OAuth account：855 Google、8 Discord、2 GitHub。GitHub 数据保留，但 UI 不新增 GitHub 登录按钮。
- Vercel Blob 共 589 个对象、约 224 MB；数据库引用 446 个且零缺失，另有 143 个孤儿对象。
- 数据库还引用 8 个项目拥有的 Bunny 文件；Google、Discord、Unsplash 图片属于第三方引用。
- `xunpanziyou.com` DNS zone 已位于 MarkYan Cloudflare 账号。

## 3. 目标架构

### 应用运行时

- TanStack Start + React 19 + Vite + `@cloudflare/vite-plugin`。
- Cloudflare Static Assets 服务构建产物，`nodejs_compat` 只用于必要的 Node 兼容依赖。
- 使用 pathless protected layout 和 route `beforeLoad` 统一保护页面；服务端写入口再次验证 Session 和资源所有权。
- 现有 React 组件、Tailwind、Radix、Zustand、Sonner、Lucide 和业务工具保持，框架专有导入在路由边界替换。

### 数据与鉴权

- Drizzle ORM + D1 SQLite。
- Better Auth 使用 D1 adapter、TanStack cookie plugin、Google/Discord social providers。
- 保留原 user ID、OAuth account 和业务外键；旧 Auth.js session 不导入。
- D1 表：Better Auth 的 `user/account/session/verification`，业务 `project/purchase/favorite/generation_task`。
- `purchaseCount` 是可见总量，purchase 行是用户成员关系；每次 toggle 在同一 D1 batch 中同时修改，且 `(userId, projectId)` 唯一。

### 文件存储

- R2 bucket：`livecanvas-builder-assets`；生产媒体域名：`lc-assets.xunpanziyou.com`。
- 新对象使用 `avatars/{userId}/{uuid}.{ext}` 与 `thumbnails/{userId}/project_{projectId}/{uuid}.jpg`。
- 写入顺序固定为“上传 R2 -> 更新 D1 URL -> 删除旧对象”；不可变对象使用长期缓存。
- 本地完整归档 589 个 Vercel Blob；R2 只导入 446 个有效 Blob 与 8 个 Bunny 文件。
- 143 个孤儿 Blob 只保存在本地归档，不进入 R2；Google、Discord、Unsplash URL 保持外部引用。

### AI 与异步任务

- 按 `docs/aihubmix-model-catalog.md` 重建 AIHubMix 模型目录唯一事实源。
- 保持 `/api/models/aihubmix`、`/api/task/submit`、`/api/task/status`、`/api/task/cancel`、`/api/chat`、`/api/metadata` 路径。
- 应用任务状态收敛为 `PENDING | RUNNING | COMPLETED | FAILED | CANCELED`。
- `generation_task` 保存任务 owner、状态、结果、usage、错误与时间，不保存 API Key 明文。
- submit 边界使用 Worker secret `TASK_PAYLOAD_KEY` 对 prompt/history/background/API Key 做 AES-GCM 加密，Workflow payload 只包含密文、nonce 和 taskId。
- Workflow 通过条件更新竞争终态；完成与取消只能有一个生效。

### 可观测性

- API、D1、R2、Workflow 和外部 AI 边界输出结构化日志。
- 日志字段包含 `requestId/taskId/userId/route/status/duration`，禁止记录 Authorization、API Key、OAuth token、完整 prompt 或生产数据内容。
- 本地 `wrangler dev` stdout、自动化测试和 D1 状态查询构成可执行闭环。

## 4. 数据副本与迁移

- 私有目录固定为 `.migration/private/`，目录权限 `0700`、文件权限 `0600`，并由 Git ignore 保护。
- 保存 PostgreSQL custom dump、逐表 JSON、D1 SQL、数据库 manifest、全部 Vercel Blob、对象 manifest 和 SHA-256。
- 导出脚本只读连接生产 PostgreSQL；转换脚本纯函数化并可在 fixture 上测试。
- D1 导入保留 ID、时间、可见 `purchaseCount` 和所有业务关系，不重算现有 5 个计数差异。
- 验证脚本比较源/目标行数、主键集合、外键、规范化内容哈希、媒体数量、字节数和 SHA-256。

## 5. 两阶段交付

### 当前阶段：本地完成

- 只创建 Git 分支、代码、文档、CST ledger 和 Git 忽略的本地数据副本。
- 使用本地 D1、R2 模拟和 Workflow 绑定完成 `wrangler dev`。
- 完成自动化测试、构建、路由/UI 回归和一次真实 AIHubMix submit -> poll -> result，以及 cancel 闭环。
- 不创建 MarkYan 账号下的任何 Worker、D1、R2、Workflow、DNS 或 secret。
- 本地验证通过后汇报访问地址、测试证据、已知风险，由用户自行验收。

### 用户验收后的线上阶段

- 用户明确确认后，另建 CST 发布工作流。
- 在 MarkYan 账号创建 staging/prod Worker、D1、R2、Workflow 和 secrets。
- staging 导入并验收后，进入约 15 分钟只读维护窗口执行最终增量、校验和 Worker Route 切换。
- 开放写入前失败可移除 Worker Route 回到 Vercel；开放写入后进入维护模式并向前修复，不做无同步的直接回切。
- Vercel、Neon、Blob 保留只读 7 天，之后单独下线。

## 6. 完成标准

- 所有旧路由存在，UI 固定数据截图在桌面与移动端无非预期差异、无重叠或溢出。
- Better Auth 登录/退出、受保护路由和资源所有权测试通过。
- 模型目录前后端使用同一规则；静态模型列表和 Edge Config 不再是事实源。
- submit/poll/cancel、chat streaming、metadata、preview/publish、gallery、favorite/purchase、profile/avatar 全部通过端到端测试。
- 本地导入数据满足行数/主键/外键/哈希断言；454 个迁移媒体全部可读且哈希匹配。
- `bun test`、typecheck、Biome、TanStack production build、Wrangler dry-run 和本地 Playwright 通过。
- `cst next` 返回 `phase=no-op` 且无 claim；线上资源仍为零新增。
