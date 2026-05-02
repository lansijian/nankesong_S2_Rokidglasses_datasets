# 语音体验站

这是一个给没有眼镜的用户体验南客松 S2 两套人格逻辑的网页版入口。

完整部署文档见：

- [EdgeOne Pages 部署说明](</e:/创造/南客松S2/Agent/voice-web-demo/docs/DEPLOY_EDGEONE_PAGES.md>)
- [Cloudflare Pages 部署说明](</e:/创造/南客松S2/Agent/voice-web-demo/docs/DEPLOY_CLOUDFLARE_PAGES.md>)

## 能力范围

- `高情商` 模式：沿用原 `SKILL.md` 的场景判断、地区风格、先理解后建议。
- `怼人` 模式：沿用原 `SKILL.md` 的主动触发、辛辣回怼、但收住明显高风险内容。
- 语音输入：浏览器原生语音识别。
- 语音播报：浏览器原生语音合成。
- 数据集：从 `high-eq-dataset/` 和 `roast-dataset/` 生成轻量知识索引。
- 部署形态：静态前端 + EdgeOne Pages `node-functions`。

## 目录

```text
voice-web-demo/
  index.html
  styles.css
  app.js
  node-functions/
    api/
      chat.js
      health.js
    _data/
      knowledge.json
  scripts/
    build-knowledge.mjs
```

## 本地准备

先生成知识索引：

```bash
node scripts/build-knowledge.mjs
```

本地测试时，把密钥写到当前目录的 `.env.local`，格式可以直接照着 [.env.example](</e:/创造/南客松S2/Agent/voice-web-demo/.env.example>) 填：

```text
OPENAI_API_KEY=你的 DeepSeek Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-v4-flash
```

`.env.local` 已经在 `.gitignore` 里，不会被提交。

如果你要本地起一个最简单的静态服务，可以在这个目录下执行：

```bash
npm run dev
```

然后访问 `http://localhost:4173`。

这个本地服务会自动读取 `.env.local` / `.env`，并把 `node-functions` 一起跑起来，适合直接联调 DeepSeek。
如果 `4173` 已被占用，它会自动切到下一个空闲端口，终端会打印实际地址。

## EdgeOne Pages 部署

1. 把仓库推到 Git。
2. 在 EdgeOne Pages 新建项目，根目录指向 `voice-web-demo/`。
3. 构建命令填：

```bash
node scripts/build-knowledge.mjs
```

4. 输出目录填：

```text
.
```

5. 在环境变量里配置：

```text
OPENAI_API_KEY=你的模型服务密钥
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

如果你们用的是兼容 OpenAI 的其他模型网关，也可以替换 `OPENAI_BASE_URL` 和 `OPENAI_MODEL`。

如果你们准备用 DeepSeek，可以直接这样预留：

```text
OPENAI_API_KEY=你的 DeepSeek Key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-v4-flash
```

当前接口层走的是 OpenAI 兼容格式，所以后面切 DeepSeek 不需要改前端。

## 这版怎么使用 SKILL 和知识库

- 前端只负责聊天界面、语音识别和发送文本。
- `node-functions/api/chat.js` 里放的是两套核心人格 prompt，对应你们原来的两份 `SKILL.md`。
- `scripts/build-knowledge.mjs` 会从 `high-eq-dataset/` 和 `roast-dataset/` 生成轻量知识索引。
- 每次对话都会先从知识索引里召回最相关的片段，再和对应模式的 prompt 一起发给模型。

也就是说，现在不是把完整 `SKILL.md` 原文塞给前端，而是把它的规则收敛进后端 prompt，把数据集尽可能转成可召回的知识片段。这种方式更适合静态站 + Edge Function。

## 演示建议

- 浏览器优先用 Chrome 或 Edge。
- 微信里点开时，建议让用户使用系统默认浏览器或右上角“在浏览器打开”，语音识别兼容性会更稳。
- 怼人模式建议在正式演示前先跑几轮样例，确认语气强度。
- 如果现场网络不稳，页面仍可做录音、识别和本地 fallback 回复，但质量会比真实模型差。
