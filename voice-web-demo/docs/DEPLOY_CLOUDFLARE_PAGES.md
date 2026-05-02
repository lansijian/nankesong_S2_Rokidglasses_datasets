# Cloudflare Pages 部署说明

这份文档对应 `voice-web-demo/`，目标是把项目部署到 Cloudflare Pages。

## 1. 当前项目如何适配 Cloudflare

为了兼容 Cloudflare Pages，这个项目现在同时保留了两套函数目录：

- `node-functions/`：给本地开发和 EdgeOne 风格结构使用
- `functions/`：给 Cloudflare Pages 使用

你不需要手动改代码，只要在 Cloudflare Pages 里部署 `voice-web-demo/` 子目录即可。

## 2. 提交前确认

仓库里应保留：

- `index.html`
- `styles.css`
- `app.js`
- `scripts/build-knowledge.mjs`
- `functions/`
- `node-functions/`
- `package.json`

不要提交：

- `.env.local`
- `dev-server.log`
- `dev-server.err.log`

## 3. 构建逻辑

Cloudflare Pages 部署时要执行：

```bash
node scripts/build-knowledge.mjs
```

这个脚本会生成两份知识库：

- `node-functions/_data/knowledge.json`
- `functions/_data/knowledge.js`

Cloudflare Pages 运行时会使用 `functions/_data/knowledge.js`。

## 4. Cloudflare Pages 控制台怎么填

如果你用的是**同一个 Git 仓库**，创建 Pages 项目时这样填：

- Framework preset: `None` 或 `Other`
- Root directory: `voice-web-demo`
- Build command: `node scripts/build-knowledge.mjs`
- Build output directory: `.`

## 5. 环境变量

在 Cloudflare Pages 项目设置里新增：

```text
OPENAI_API_KEY=你的 DeepSeek Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-v4-flash
```

## 6. 部署后检查

部署完成后先测：

### 健康检查

```text
https://你的-pages-域名/api/health
```

返回类似：

```json
{"ok":true,"service":"voice-web-demo","platform":"cloudflare-pages"}
```

### 聊天页面

测试：

- 高情商模式：先选地区，再说场景
- 怼人模式：直接输入一句回怼场景

## 7. 注意

Cloudflare Pages 的默认域名虽然更容易直接访问，但对中国大陆用户的稳定性**不如国内基础设施**。如果你后面发现大陆访问波动，这是平台地域带来的典型现象，不是你代码结构有问题。
