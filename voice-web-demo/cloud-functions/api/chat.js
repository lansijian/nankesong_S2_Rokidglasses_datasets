import knowledge from "./knowledge.js";

const REGION_STYLES = {
  default: "标准普通话，简洁、自然、不过度表演。",
  山东: "实在、厚道，措辞稳重，可以少量使用“您”“咱”。",
  东北: "爽快、亲切，略带幽默，但别太炸。",
  川渝: "热情、麻利，轻微泼辣感，但不油。",
  广东: "低调、务实、礼貌，少量自然口头感。",
  北京: "松弛、能聊，略带京味儿，但保持得体。",
  江苏: "温和、细腻、婉转，语气柔和。"
};

const HIGH_EQ_PROMPT = `你是“高情商随身军师”的网页版版本，延续原有 SKILL 逻辑，但当前没有图片输入，只有用户口述。

你的核心规则：
1. 先理解，再建议。
2. 自动从用户文本判断更像职场、社交还是宠物场景。
3. 优先给短、能马上说出口的话术，必要时补一个动作建议。
4. 如果信息不足，先追问一个最关键的问题，不要连续追问很多个。
5. 不给医疗诊断，不给操控性、PUA 式或高风险建议。
6. 输出避免 AI 腔，不要写“根据分析”“建议您”这种话。
7. 用户如果选择了地区风格，就稳定贯彻。
8. 如果给了知识片段，优先吸收其中的表达方式、判断思路和场景经验，再组织成自然回复，不要忽视知识片段。
9. 回复像手机里一个懂事、机灵、会读空气的朋友，不要像客服，也不要像论文。
10. 可以少量自然加入表情或语气词，比如“嗯”“好”“行”“🙂”“😂”“😮‍💨”，但不要堆太多。

输出格式要求：
- 默认返回 2 小段短内容：
  第 1 段：你对场面的理解，像是在帮用户读空气。
  第 2 段：给用户可直接复述的话，必要时再补一个小动作。
- 不要写“第一段”“第二段”“你读到的空气”“你可以说”这类标题。
- 总长度尽量控制在 90 到 140 字。
- 如果需要追问，就只返回一句追问。`;

const ROAST_PROMPT = `你是“怼人模式”的网页版版本，延续原有 SKILL 逻辑，但当前没有图片输入，只有用户口述。

你的核心规则：
1. 只有在用户主动进入怼人模式时才工作。
2. 永远不要攻击用户本人。
3. 保持辛辣、阴阳、刻薄，但不要出现真正脏话。
4. 禁止鼓励暴力、违法、仇恨、骚扰、未成年人伤害。
5. 可以给“回怼话术”，也可以给“更损一点版本”，但不能越线。
6. 如果目标是宠物，只能做毒舌吐槽，不允许伤害建议。
7. 尽量像真人回嘴，不要像在念规则。
8. 如果给了知识片段，优先参考其中的句式和攻击角度，但要自动避开脏话和高风险内容。
9. 语气要有点坏笑、机灵、阴阳感，像朋友悄悄递给用户一句好用的回嘴。
10. 可以少量带表情，比如“😏”“🙂”“🤨”“🙃”，但不要每句都带。

输出格式要求：
- 默认输出两小段：
  第 1 段：点破对方最欠的地方。
  第 2 段：给用户一句可直接说出口的回怼话。
- 不要写“第一段”“第二段”“回他”这类标题。
- 总长度尽量控制在 70 到 120 字。`;

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const text = String(body?.text || "").trim();
    const mode = body?.mode === "roast" ? "roast" : "high-eq";
    const region = REGION_STYLES[body?.region] ? body.region : "default";
    const history = Array.isArray(body?.history) ? body.history.slice(-8) : [];
    const scene = inferScene(text);
    const replyGoal = inferReplyGoal({ mode, scene, text });
    const roastIntensity = inferRoastIntensity(text);

    if (!text) {
      return json(
        {
          ok: false,
          error: "EMPTY_INPUT",
          message: "请先说点什么。"
        },
        400
      );
    }

    const snippets = retrieveKnowledge({
      mode,
      text,
      region,
      items: mode === "roast" ? knowledge.roast : knowledge.highEq
    });

    let rawAnswer;
    if (env?.OPENAI_API_KEY) {
      try {
        rawAnswer = await generateWithModel({
          env,
          mode,
          region,
          text,
          history,
          snippets,
          scene,
          replyGoal,
          roastIntensity
        });
      } catch {
        rawAnswer = generateFallback({ mode, region, text, snippets, scene });
      }
    } else {
      rawAnswer = generateFallback({ mode, region, text, snippets, scene });
    }
    const answer = polishAnswer(rawAnswer, { mode, scene });

    return json({
      ok: true,
      mode,
      scene,
      answer,
      transcript: text,
      snippets: snippets.map((item) => ({
        source: item.source,
        tags: item.tags
      }))
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "SERVER_ERROR",
        message: error instanceof Error ? error.message : "Unknown server error"
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({
    ok: true,
    service: "chat",
    message: "POST text to this endpoint."
  });
}

function retrieveKnowledge({ mode, text, region, items }) {
  const query = `${text} ${region}`.toLowerCase();
  const keywords = tokenize(query);
  return items
    .map((item) => {
      const haystack = `${item.text} ${item.tags.join(" ")} ${item.source}`.toLowerCase();
      let score = item.score || 0;
      for (const token of keywords) {
        if (haystack.includes(token)) score += token.length > 1 ? 2 : 0.5;
      }
      if (mode === "high-eq" && /领导|同事|客户|汇报|开会|导师/.test(text) && item.tags.includes("workplace")) score += 4;
      if (mode === "high-eq" && /猫|狗|宠物/.test(text) && item.tags.includes("pet")) score += 4;
      if (mode === "roast" && /甩锅|阴阳|装|放鸽子/.test(text) && (item.tags.includes("social") || item.tags.includes("workplace"))) score += 3;
      return { ...item, retrievalScore: score };
    })
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, 5);
}

function tokenize(text) {
  const parts = text
    .split(/[\s,，。！？；：、"'“”‘’（）()【】\[\]\-_/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const chars = [...text].filter((ch) => /[\u4e00-\u9fff]/.test(ch));
  return [...new Set([...parts, ...chars].filter((token) => token.length <= 12))];
}

async function generateWithModel({ env, mode, region, text, history, snippets, scene, replyGoal, roastIntensity }) {
  const prompt = mode === "roast" ? ROAST_PROMPT : HIGH_EQ_PROMPT;
  const regionStyle = REGION_STYLES[region] || REGION_STYLES.default;
  const context = snippets
    .map((item, index) => `${index + 1}. [${item.tags.join(",")}] ${item.text}`)
    .join("\n");
  const workflowContext = mode === "roast"
    ? `当前场景：${scene}\n当前怼人强度：${roastIntensity}\n当前目标：给一句能直接说出口的回怼话，并保持不越线。`
    : `当前场景：${scene}\n当前回复目标：${replyGoal}\n请按高情商随身军师的流程，先读懂场面，再给用户一句能落地的话。`;
  const messages = [
    {
      role: "system",
      content: `${prompt}\n\n当前地区风格：${regionStyle}\n${workflowContext}\n\n以下知识片段来自项目知识库，请尽量吸收其判断方式、措辞风格和场景经验，不要机械复述：\n${context || "暂无"}`
    },
    ...history
      .filter((item) => item && typeof item.role === "string" && typeof item.content === "string")
      .map((item) => ({ role: item.role, content: item.content })),
    { role: "user", content: text }
  ];

  const baseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const response = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "deepseek-v4-flash",
      temperature: mode === "roast" ? 0.9 : 0.7,
      messages
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Model request failed: ${response.status} ${detail}`);
  }

  const payload = await response.json();
  return payload?.choices?.[0]?.message?.content?.trim() || generateFallback({ mode, region, text, snippets, scene });
}

async function fetchWithRetry(url, init, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await delay(350 * (attempt + 1));
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateFallback({ mode, region, text, snippets, scene }) {
  const lead = snippets[0]?.text || "";
  if (mode === "roast") {
    return `听着就知道对方挺欠的。\n你可以回他一句：“${buildRoastLine(text)}”`;
  }
  return `我大概听出来这更像是${scene}的场面。\n你可以先说：“${buildHighEqLine(text, region, lead)}”`;
}

function inferScene(text) {
  if (/猫|狗|宠物/.test(text)) return "宠物";
  if (/领导|同事|客户|导师|汇报|开会|面试/.test(text)) return "职场";
  return "社交";
}

function inferReplyGoal({ mode, scene, text }) {
  if (mode === "roast") return "回怼";
  if (/怎么说|怎么回|回什么|接话/.test(text)) return "稳妥回话";
  if (/开场|破冰|聊什么/.test(text)) return "自然开场";
  if (/夸|表扬|谢谢|夸奖/.test(text)) return "得体回应";
  if (scene === "职场") return "稳妥回话";
  if (scene === "宠物") return "安全互动";
  return "避免冷场";
}

function inferRoastIntensity(text) {
  if (/往死里|最狠|狠一点|毒一点|再狠|猛一点/.test(text)) return "加强";
  return "标准";
}

function buildHighEqLine(text, region, lead) {
  const prefix =
    region === "广东" ? "慢慢来，我先听明白" :
    region === "东北" ? "别急，我先把话接稳" :
    region === "江苏" ? "不妨先把意思说顺" :
    "我先把情况说清楚";
  if (/夸|表扬|夸奖/.test(text)) return `${prefix}，谢谢你这么说，我也还在继续学。`;
  if (/领导|同事|客户|导师|汇报|开会/.test(text)) return `${prefix}，我理解您的关注点是结果和节奏，我这边马上补上关键进展。`;
  if (/猫|狗|宠物/.test(text)) return `${prefix}，先别急着碰它，我蹲低一点，等它主动靠近。`;
  return `${prefix}，我先回应你的重点，别让场面掉下去。`;
}

function buildRoastLine(text) {
  if (/甩锅/.test(text)) return "这锅你甩得挺顺手啊，可惜我今天不接盘。";
  if (/阴阳|装/.test(text)) return "你这点弯弯绕，隔着两条街都闻见了。";
  if (/放鸽子/.test(text)) return "你时间宝贵我理解，但做人别像临时撤回的消息。";
  if (/领导|同事|客户/.test(text)) return "你先把自己的活捋明白，再来安排我。";
  if (/狗|猫|宠物/.test(text)) return "你这拆家本事挺稳定，今天先把气焰收一收。";
  return "你先把自己那点毛病收拾明白，再来跟我摆谱。";
}

function polishAnswer(answer, { mode, scene }) {
  let text = String(answer || "").trim();
  text = text.replace(/\*\*(读空气|直接说|你可以说|第一段|第二段)\*\*\s*/g, "");
  text = text.replace(/^(读空气|直接说|你可以说|第一段|第二段)[:：]\s*/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  if (mode === "roast") {
    text = text.replace(/^(嗯|好|行)[，,、]?\s*/g, "");
    if (!/[😏🙃🤨😂]/.test(text)) {
      text = `${text} ${scene === "职场" ? "😏" : "🙃"}`.trim();
    }
    if (!/[🙂😏🙃🤨😂].*\n/.test(text) && text.includes("\n")) {
      text = text.replace("\n", " 😏\n");
    }
    return text;
  }

  if (!/[🙂😮‍💨✨]/.test(text) && scene === "宠物") {
    text = `${text} 🙂`.trim();
  }

  return text;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
