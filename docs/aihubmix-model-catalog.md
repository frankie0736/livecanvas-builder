# AIHubMix 模型目录改造说明

## 背景

原实现把模型列表维护在 Vercel Edge Config 中，同时在前端和服务端保留多家模型提供商的固定类型与适配逻辑。该实现存在三个问题：

1. 模型信息会随提供商更新而过期，需要人工维护。
2. 设置页面实际上只允许用户填写 AIHubMix API Key，多提供商模型结构与真实产品能力不一致。
3. 模型名称、能力和可用性存在多个事实来源，容易出现前端可选但服务端不可用的状态。

本次改造将 AIHubMix 模型列表 API 设为模型选择功能的唯一事实来源，并把用户可见模型控制在少量近期 GPT 与 Claude 模型内。

对应提交：`5cfeced feat: use AIHubMix as model catalog source`

## 设计边界

稳定轴：用户仍然通过自己的 AIHubMix API Key 选择模型并提交页面生成任务。

变化轴：模型列表从静态配置改为运行时读取 AIHubMix 模型目录。

不变量：前端展示、默认选择和服务端提交校验必须使用同一份 AIHubMix 模型目录，不能各自维护模型白名单。

数据流如下：

```text
用户 AIHubMix API Key
        |
        v
GET /api/models/aihubmix
        |
        v
AIHubMix /api/v1/models
        |
        v
标准化 + 精选模型算法
        |
        +--> 前端模型选择与默认值
        |
        +--> 提交接口模型有效性校验
        |
        +--> metadata 生成默认模型
```

## 主要改动

### 1. AIHubMix 成为模型目录 SSOT

新增 `src/lib/aihubmix-models.ts`，集中维护：

- AIHubMix 模型目录地址：`https://aihubmix.com/api/v1/models?types=llm&sort_by=coding`
- AIHubMix Chat API 地址：`https://aihubmix.com/v1`
- 外部响应标准化
- 模型厂商识别
- 精选模型选择规则
- 推荐模型顺序
- 模型 ID 有效性判断

模型目录请求使用用户自己的 AIHubMix API Key，不依赖服务端共享 AIHubMix Key。请求和响应均设置为 `no-store`，避免按用户密钥获取的数据被公共缓存。

### 2. 动态精选近期 GPT 与 Claude 模型

程序不会把 AIHubMix 返回的全部模型直接展示给用户，而是动态选择：

- 最近两个 GPT 正式代际，每个代际只保留一个优先版本
- 最新一代 Claude Sonnet
- 最新一代 Claude Opus

GPT 选择会排除 `audio`、`chat`、`codex`、`embedding`、`image`、`preview`、`realtime`、`search`、`speech` 等专用变体。同一代际存在多个候选时，优先普通版本，其次按已定义的通用版本优先级选择。

Claude 通过 `claude-sonnet-*` 和 `claude-opus-*` 的版本号动态排序。AIHubMix 后续上架新一代正式模型后，模型选择界面会随目录自动更新，不需要再次修改固定 ID。

### 3. 正确使用模型显示名称

AIHubMix 返回值中的长说明可能位于 `name` 字段，例如 Smart Router 的完整使用说明。标准化逻辑现在按以下顺序确定显示名称：

1. `model_name`
2. `name`
3. 模型 ID

模型选择器因此优先显示简短、稳定的官方模型名称，不再把长说明直接放进选项标题。

### 4. 新增模型目录 API

新增接口：

```http
GET /api/models/aihubmix
Authorization: Bearer <user-aihubmix-api-key>
```

成功响应结构：

```json
{
  "models": [],
  "recommendedModelIds": [],
  "fetchedAt": "2026-07-10T00:00:00.000Z"
}
```

接口负责调用 AIHubMix、标准化外部数据并执行精选算法。前端不直接解析 AIHubMix 原始响应。

### 5. 前端模型目录状态统一

新增 `ModelCatalogProvider`，统一管理：

- 当前模型列表
- 推荐模型 ID
- API Key 是否存在
- 加载状态
- 错误状态
- 手动刷新动作
- 当前对话中的默认模型同步

Dashboard、模型选择器、结果费用展示和表单不再分别接收或维护模型列表。

模型选择器支持：

- 默认只显示精选模型
- 按模型 ID、名称、厂商、能力和类型搜索
- 手动刷新 AIHubMix 模型目录
- API Key 缺失、加载中和目录错误状态
- 目录更新后自动修正已经失效的历史选择

### 6. 服务端提交使用同一目录校验

`POST /api/task/submit` 在创建任务前，使用用户 API Key 获取同一份 AIHubMix 精选目录，并校验 `modelId` 是否仍然有效。

这样可以避免以下无效状态：

- 前端使用已经下架的固定模型 ID
- 前端与服务端维护不同白名单
- 非 AIHubMix provider 被提交到只支持 AIHubMix 的运行链路

提交入口新增 `requestId`，错误日志包含用户、provider、model 和错误链上下文，但不会记录 API Key。

### 7. 收窄模型提供商边界

类型和运行时模型工厂现在只支持 `aihubmix` provider。移除了当前产品无法配置的提供商依赖和静态配置，包括：

- DeepSeek provider
- OpenRouter provider
- Qwen provider
- Vercel Edge Config 模型列表
- 服务端 `OPENROUTER_API_KEY`
- 服务端 `AI_HUB_MIX_API_KEY`

OpenAI 与 Anthropic 模型仍可使用，但统一通过 AIHubMix 的 OpenAI-compatible API 调用。

### 8. 模型生成返回路径简化

Trigger task 不再依赖静态的 `canOutputStructuredData` 能力标记，也不再按模型切换 `generateObject` 和 `generateText`。所有精选模型统一通过 `generateText` 返回文本，由既有响应解析链路提取生成结果。

该调整删除了由静态模型能力表产生的分支，避免新模型因为缺少本地能力配置而走错生成路径。

### 9. Trigger 项目配置可覆盖

`trigger.config.ts` 支持通过 `TRIGGER_PROJECT_ID` 指定项目，同时保留原仓库项目 ID 作为默认值：

```ts
project: process.env.TRIGGER_PROJECT_ID ?? "proj_orqqxvkstrfkkapvdwqr"
```

这允许 fork 使用自己的 Trigger 项目，而不会要求原仓库修改现有项目 ID。

## 验证

已执行：

```bash
bun test
bun run typecheck
bun run check
```

结果：

- 38 个测试通过
- TypeScript 类型检查通过
- Biome 检查通过
- AIHubMix 模型目录接口已在本地返回精选模型

新增测试覆盖：

- AIHubMix 原始模型标准化
- `model_name` 显示名称优先级
- 非 LLM 模型过滤
- GPT 与 Claude 动态精选规则
- 用户 API Key 转发
- 空目录和无匹配模型错误
- 提交按钮对提示词、API Key 和模型选择的基本就绪判断

## 已知限制

### Trigger.dev v3 已停止服务

当前代码仍依赖 `@trigger.dev/sdk/v3`，包括任务提交、状态查询、取消和 worker 定义。Trigger.dev 服务端当前会返回：

```text
Trigger.dev v3 is no longer supported. Please upgrade your project to v4.
```

因此，本次改动完成了模型目录与模型选择重构，但没有修复生产生成链路的 500 错误。仅配置新的 Trigger project ID 或 secret key 不能解决协议版本失效。

后续需要把以下边界整体迁移到 Trigger.dev v4，并重新部署 worker：

- `src/app/api/task/submit/route.ts`
- `src/app/api/task/status/route.ts`
- `src/app/api/task/cancel/route.ts`
- `src/trigger/chat-generation.ts`
- `trigger.config.ts`
- Trigger.dev SDK 与 build dependencies

迁移时必须保持现有的 submit -> poll -> cancel 接口契约以及 task 输出结构一致。

### 端到端生成尚未验证

静态检查和模型目录测试已经通过，但由于 Trigger.dev v3 停服，目前无法完成一次真实的提交、异步执行、轮询和结果展示闭环。Trigger.dev v4 迁移完成后，需要补做该端到端验证。

### 发送按钮仍需浏览器回归验证

提交按钮的就绪条件已经收敛为：存在非空提示词、存在 AIHubMix API Key、存在已选模型。相关单元测试已通过，但此前浏览器中出现过按钮保持 disabled、快捷键仍可提交的现象。Trigger.dev v4 迁移后，应在真实登录状态下重新验证鼠标提交与快捷键提交使用同一就绪条件。

## PR 边界

本次提交应描述为“使用 AIHubMix 模型目录作为 SSOT，并动态精选近期 GPT/Claude 模型”，不应描述为“修复生成 500”。

生成 500 的当前主要原因是 Trigger.dev v3 停服，需要由后续 v4 迁移独立闭环。
