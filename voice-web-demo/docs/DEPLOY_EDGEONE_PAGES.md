# EdgeOne Pages 部署说明

这份文档给 `voice-web-demo/` 这套站点使用，目标是把它部署成一个可以在手机端直接打开的语音聊天网页。

## 1. 项目形态

这套站点不是纯静态 HTML。

- 前端页面：`index.html`、`styles.css`、`app.js`
- 接口层：`node-functions/api/chat.js`、`node-functions/api/health.js`
- 知识库构建：`scripts/build-knowledge.mjs`

也就是说，部署时需要：

1. 托管静态页面
2. 托管 `node-functions`
3. 在构建阶段生成 `node-functions/_data/knowledge.json`
4. 配好环境变量，让接口层能调用 DeepSeek

## 2. 本地测试

先在项目根目录创建 `.env.local`：

```text
OPENAI_API_KEY=你的 DeepSeek Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-v4-flash
```

然后执行：

```bash
node scripts/build-knowledge.mjs
npm run dev
```

如果 `4173` 被占用，服务会自动切到下一个空闲端口。

打开终端打印的地址，例如：

```text
http://localhost:4173
```

先验一下：

- `http://localhost:4173/api/health`
- 页面右上角状态是否显示 `已连接`

## 3. EdgeOne Pages 创建项目

在 EdgeOne Pages 控制台创建新项目时：

- 如果你使用的是**当前这个同一个仓库**，Root Directory 填：`voice-web-demo`
- 如果你后面单独拆了一个网页仓库，Root Directory 填：`.`
- 构建命令：

```bash
node scripts/build-knowledge.mjs
```

- 输出目录：

```text
.
```

这一套的核心思路是：

- 页面文件直接从项目根目录发布
- `node-functions/` 由 Pages 托管成函数
- 构建命令负责把知识库文件生成到 `node-functions/_data/knowledge.json`

### 同仓库部署建议

当前推荐你直接沿用同一个 Git 仓库，把 `voice-web-demo/` 作为部署子目录：

- 仓库：当前主仓库
- Root Directory：`voice-web-demo`
- Build Command：`node scripts/build-knowledge.mjs`
- Output Directory：`.`

## 4. 环境变量

在 EdgeOne Pages 的环境变量里配置：

```text
OPENAI_API_KEY=你的 DeepSeek Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-v4-flash
```

说明：

- 这里虽然变量名是 `OPENAI_*`，但只是因为接口层走了 OpenAI 兼容格式
- 实际上当前默认接的是 DeepSeek
- 如果以后要切别的兼容网关，只改 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`

## 5. 上线前检查

部署成功后，先做 4 个检查：

1. 页面能打开
2. `GET /api/health` 返回 `ok: true`
3. 页面顶部状态从 `待机中` 变成 `已连接`
4. 聊天时能拿到真实模型回复，而不是 fallback 模板

## 6. 这版如何使用 SKILL 和知识库

当前不是把整份 `SKILL.md` 原文塞给前端，而是拆成两层：

### 第一层：后端 prompt

在 `node-functions/api/chat.js` 里：

- 高情商模式继承你们原 `SKILL` 的核心规则：
  - 先理解，再建议
  - 按地区风格持续输出
  - 自动识别职场 / 社交 / 宠物场景
  - 优先给能直接说出口的话

- 怼人模式继承原 `SKILL` 的核心规则：
  - 只在用户主动进入时工作
  - 不攻击用户本人
  - 不输出真正脏话
  - 不给暴力违法建议
  - 宠物场景只允许毒舌吐槽

### 第二层：知识库召回

`scripts/build-knowledge.mjs` 会从：

- `high-eq-dataset/`
- `roast-dataset/`

生成一个轻量索引：

- `node-functions/_data/knowledge.json`

每次对话前，后端会先按用户输入做召回，再把相关片段和对应模式的 prompt 一起发给模型。

这比把原始语料整包塞给模型更适合静态站 + Edge Function。

## 7. 手机端演示建议

- 浏览器优先用 Chrome / Edge / 手机系统浏览器
- 微信内打开时，语音识别兼容性不稳定，建议准备“在浏览器打开”的兜底说法
- 高情商模式先走一遍“选地区 -> 说场景”
- 怼人模式准备几条样例：
  - 同事甩锅
  - 客户装腔
  - 对方阴阳怪气

## 8. 常见问题

### 8.1 页面能打开，但回复像模板

说明函数层没有成功连到模型，通常检查：

- 环境变量有没有配
- 模型名是不是 `deepseek-v4-flash`
- `OPENAI_BASE_URL` 是否是 `https://api.deepseek.com/v1`

### 8.2 页面里提示 `fetch failed`

先检查：

- 当前打开的地址，是不是部署后 Pages 给你的最新地址
- `GET /api/health` 是否正常
- 页面顶部状态是不是 `已连接`

### 8.3 本地跑 `npm run dev` 时端口占用

当前开发服务会自动顺延端口，不需要手动改代码。看终端实际输出地址即可。

## 9. 官方文档

部署和函数能力建议以 EdgeOne 官方文档为准：

- EdgeOne Pages 文档首页：https://pages.edgeone.ai/
- 产品介绍：https://pages.edgeone.ai/document/product-introduction

DeepSeek API 文档：

- 文档首页：https://api-docs.deepseek.com/
- Chat Completions：https://api-docs.deepseek.com/api/create-chat-completion
