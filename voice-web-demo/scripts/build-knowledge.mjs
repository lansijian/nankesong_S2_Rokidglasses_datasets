import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const outputDir = path.resolve(process.cwd(), "node-functions", "_data");
const outputFile = path.join(outputDir, "knowledge.json");

const highEqRoot = path.join(root, "high-eq-dataset");
const roastRoot = path.join(root, "roast-dataset");

const HIGH_EQ_LIMIT = 140;
const ROAST_LIMIT = 120;

const fileTagMap = [
  { match: ["职场", "领导", "同事", "开会", "汇报", "导师"], tags: ["workplace"] },
  { match: ["宠物", "小猫", "小狗", "猫", "狗"], tags: ["pet"] },
  { match: ["冲突", "冷战", "道歉", "矛盾", "争吵"], tags: ["conflict"] },
  { match: ["送礼", "礼物", "长辈", "茶叶"], tags: ["gifting"] },
  { match: ["饭局", "酒局", "敬酒", "餐桌"], tags: ["etiquette"] },
  { match: ["聊天", "社交", "开场", "夸奖", "安慰"], tags: ["social"] }
];

const roastTagMap = [
  { match: ["领导", "同事", "客户", "加班", "甩锅"], tags: ["workplace"] },
  { match: ["手机", "放鸽子", "阴阳", "装", "聊天"], tags: ["social"] },
  { match: ["狗", "猫", "宠物"], tags: ["pet"] }
];

const bannedRoastTerms = [
  "操",
  "草你",
  "艹",
  "妈的",
  "你妈",
  "他妈",
  "傻逼",
  "煞笔",
  "sb",
  "cnm",
  "杀",
  "砍",
  "揍",
  "捅",
  "弄死"
];

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(resolved);
      }
      return [resolved];
    })
  );
  return files.flat();
}

function normalizeText(text) {
  return text.replace(/\r/g, "").replace(/\u0000/g, "").trim();
}

function splitParagraphs(text) {
  return normalizeText(text)
    .split(/\n\s*\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitRoastLines(text) {
  return normalizeText(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferTags(text, filePath, tagMap) {
  const bucket = new Set();
  const haystack = `${filePath} ${text}`;
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath.includes("/communication/")) bucket.add("social");
  if (normalizedPath.includes("/conflict/")) bucket.add("conflict");
  if (normalizedPath.includes("/etiquette/")) bucket.add("etiquette");
  if (normalizedPath.includes("/gifting/")) bucket.add("gifting");
  if (normalizedPath.includes("/hospitality/")) bucket.add("social");
  if (normalizedPath.includes("/awkwardness/")) bucket.add("social");
  for (const rule of tagMap) {
    if (rule.match.some((keyword) => haystack.includes(keyword))) {
      rule.tags.forEach((tag) => bucket.add(tag));
    }
  }
  if (bucket.size === 0) {
    bucket.add("general");
  }
  return [...bucket];
}

function scoreHighEq(text, filePath) {
  let score = 0;
  if (text.length >= 50 && text.length <= 260) score += 3;
  if (/[。？！；]/.test(text)) score += 1;
  if (/可以|建议|不妨|先|再|如果|最好|沟通|表达|回应/.test(text)) score += 3;
  if (/职场|社交|聊天|道歉|夸奖|饭局|礼貌|冷战|安慰|开场/.test(`${filePath} ${text}`)) score += 2;
  return score;
}

function scoreRoast(text, filePath) {
  let score = 0;
  if (text.length >= 12 && text.length <= 70) score += 3;
  if (/你|您|这|别|就是|像|配|嘴|脸/.test(text)) score += 2;
  if (/甩锅|装|阴阳|鸽子|手机|客户|同事|领导|狗|猫/.test(`${filePath} ${text}`)) score += 2;
  if (bannedRoastTerms.some((term) => text.toLowerCase().includes(term))) score -= 10;
  return score;
}

async function buildHighEq() {
  const files = await listFiles(highEqRoot);
  const items = [];
  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const paragraphs = splitParagraphs(content);
    for (const paragraph of paragraphs) {
      const score = scoreHighEq(paragraph, filePath);
      if (score < 5) continue;
      items.push({
        text: paragraph.slice(0, 260),
        source: path.relative(root, filePath).replace(/\\/g, "/"),
        tags: inferTags(paragraph, filePath, fileTagMap),
        score
      });
    }
  }

  items.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  return dedupe(items, HIGH_EQ_LIMIT);
}

async function buildRoast() {
  const files = await listFiles(roastRoot);
  const items = [];
  for (const filePath of files) {
    if (filePath.endsWith("harmful_sentences.txt")) continue;
    const content = await fs.readFile(filePath, "utf8");
    const lines = splitRoastLines(content);
    for (const line of lines) {
      const score = scoreRoast(line, filePath);
      if (score < 4) continue;
      if (bannedRoastTerms.some((term) => line.toLowerCase().includes(term))) continue;
      items.push({
        text: line.slice(0, 90),
        source: path.relative(root, filePath).replace(/\\/g, "/"),
        tags: inferTags(line, filePath, roastTagMap),
        score
      });
    }
  }

  items.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  return dedupe(items, ROAST_LIMIT);
}

function dedupe(items, limit) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = item.text.replace(/[，。！？；、“”‘’,.!?;:：\s]/g, "");
    if (key.length < 12 || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

async function main() {
  const [highEq, roast] = await Promise.all([buildHighEq(), buildRoast()]);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    outputFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: { highEq: highEq.length, roast: roast.length },
        highEq,
        roast
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Knowledge written to ${outputFile}`);
  console.log(`High EQ: ${highEq.length}, Roast: ${roast.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
