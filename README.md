# 南客松 S2 · Rokid AI 眼镜智能体数据集与技能

本仓库面向部署在 **Rokid AI Glasses（Rokid 智能眼镜）** 上的两条智能体产品线，配套**可公开 / 可开源**的文本数据集，以及仓库根目录 **`skills/`** 下的 **Agent Skill**（`SKILL.md`），便于协作开发与复现人设与工作流。若需在 Cursor 内作为项目 Skill 使用，可将对应子目录复制或链接到本项目的 `.cursor/skills/`，或按 Cursor 文档放入个人 `~/.cursor/skills/`。

## 项目概览

| 方向 | 定位 | 本仓库内容 |
|------|------|------------|
| **高情商助手** | 基于单帧拍照的场景理解，输出得体、可执行的沟通话术与动作建议（职场 / 轻社交 / 宠物），支持地区语气个性化。 | `high-eq-dataset/` 文本语料；`skills/rokid-high-eq-assistant/SKILL.md` |
| **怼人助手** | 在用户明确触发「怼他」类意图时，结合画面给出刻薄但**不含真正脏话**的反击话术（含安全与宠物边界）。 | `roast-dataset/` 文本语料；`skills/rokid-roast-assistant/SKILL.md` |

智能体侧通常还会对接：摄像头单帧（如 `notify_take_photo`）、多模态工作流（如灵珠）、眼镜角标静默显示、`get_context_param` / `recallKnowledge` 等；具体以各 Skill 内「工具关联」与「工作流」章节为准。

## 仓库结构

```
.
├── README.md
├── skills/                            # Agent Skill（独立于 .cursor）
│   ├── rokid-high-eq-assistant/
│   │   └── SKILL.md
│   └── rokid-roast-assistant/
│       └── SKILL.md
├── high-eq-dataset/                   # 高情商助手公开数据集（.txt 正文保留中文文件名）
│   ├── awkwardness/                   # 尴尬与社交边界类
│   ├── communication/                 # 沟通与职场表达类
│   ├── conflict/                     # 冲突、情绪与和解类
│   ├── etiquette/                    # 饭局酒桌礼仪类
│   ├── gifting/                      # 送礼与人情类
│   └── hospitality/                  # 聚餐与待人接物类
└── roast-dataset/                     # 怼人助手开源数据集（.txt 正文保留中文文件名）
    ├── cold.txt
    ├── harmful_sentences.txt
    ├── 往里干.txt
    └── 往死里干.txt
```

**命名说明**：除 `.txt` 资源文件外，目录与说明性 Markdown 已统一为**英文命名**，便于 GitHub 与跨平台路径兼容；`.txt` 内文与部分中文文件名保留，与原始语料一致。

## 数据集说明

### `high-eq-dataset/`

按主题分子目录的**长篇结构化文本**，覆盖高情商沟通、职场、家庭、酒局饭局、送礼等场景，供 RAG / `recallKnowledge` 或离线知识库切片使用。

- **awkwardness**：尴尬场合、拒绝、夸奖回应、恋爱教训等。  
- **communication**：亲子、导师、安慰、潜台词、异性聊天技巧等。  
- **conflict**：道歉、冷战、家庭矛盾、情绪管理等。  
- **etiquette**：酒局、敬酒、座次、夸赞话术等。  
- **gifting**：选礼、过年长辈、茶叶等。  
- **hospitality**：聚餐、人际交往分寸等。

### `roast-dataset/`

怼人向句式与分类语料（含英文命名的分类文件与中文命名的强度档），与 Skill 中 `recallKnowledge` 的「怼人 / 往死里骂」等标签对应关系由你在工程里自行映射。

- `cold.txt`、`harmful_sentences.txt`：英文文件名的分类/句式资源。  
- `往里干.txt`、`往死里干.txt`：中文文件名的加强档语料（内容可能更尖锐，接入产品时务必叠加内容安全与合规策略）。

## Agent Skills（SKILL.md）

本仓库在 `skills/<skill-name>/SKILL.md` 下提供两条智能体说明（格式兼容 Cursor Agent Skill 的 frontmatter + 正文）：

| Skill 目录 | `name`（frontmatter） | 用途 |
|------------|----------------------|------|
| `rokid-high-eq-assistant` | `rokid-high-eq-assistant` | 高情商眼镜军师：地区选择、三场景模式、拍照频次、输出长度与安全边界。 |
| `rokid-roast-assistant` | `rokid-roast-assistant` | 怼人眼镜军师：触发词、混搭方言风格、知识库分级、离线兜底、禁止项。 |

在 Cursor 中可将本仓库作为项目打开并 `@` 引用对应 `SKILL.md`，或把 `skills/rokid-*` 复制/软链到 `.cursor/skills/`（或 `~/.cursor/skills/`）以便按内置 Skill 加载。

## 使用与合规提示

- 数据集仅供研究、产品与**有审核的**对话系统使用；上线前请完成内容安全、未成年人保护与当地法规评估。  
- 「怼人」方向语料默认面向**成人向、用户主动触发**场景，请勿用于骚扰、欺凌或针对真实个人的自动化攻击。  
- 高情商方向语料不构成心理咨询或医疗建议；涉及情绪与关系问题时，产品侧应保留人工与专业渠道入口。

## 许可证

本仓库根目录 [`LICENSE`](LICENSE) 采用 **MIT License**。若你希望仅对语料采用知识共享等协议，可自行拆分多许可证说明并更新本段与 `LICENSE` 文件。

## 致谢

硬件与生态：**Rokid** AI 眼镜。多模态与工作流以各团队实际对接的「灵珠」等平台为准。

---

**南客松 S2** · 数据集与技能仓库 · 准备上传 GitHub 时可本 README 为默认说明页。
