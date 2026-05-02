const REGION_OPTIONS = ["标准普通话", "山东", "东北", "川渝", "广东", "北京", "江苏"];

const state = {
  mode: "high-eq",
  region: null,
  recording: false,
  autoSpeak: true,
  history: [],
  isAnimating: false
};

const elements = {
  modeButtons: [...document.querySelectorAll(".mode-button")],
  networkStatus: document.getElementById("networkStatus"),
  chatList: document.getElementById("chatList"),
  voiceHint: document.getElementById("voiceHint"),
  micButton: document.getElementById("micButton"),
  textInput: document.getElementById("textInput"),
  sendButton: document.getElementById("sendButton")
};

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    state.recording = true;
    renderRecording();
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let liveText = "";

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0]?.transcript || "";
      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        liveText += transcript;
      }
    }

    const nextText = (finalText || liveText).trim();
    if (nextText) {
      elements.textInput.value = nextText;
      autoResize();
      elements.voiceHint.textContent = finalText
        ? "识别完成，可以直接发送。"
        : `正在识别: ${nextText}`;
    }
  };

  recognition.onend = () => {
    state.recording = false;
    renderRecording();
  };

  recognition.onerror = (event) => {
    state.recording = false;
    renderRecording();
    elements.voiceHint.textContent = `语音识别失败: ${event.error || "未知错误"}，你也可以直接打字。`;
  };
} else {
  elements.voiceHint.textContent = "当前浏览器不支持语音识别，建议用 Chrome 或 Edge，也可以直接打字。";
}

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (state.mode === button.dataset.mode) return;
    state.mode = button.dataset.mode;
    resetConversation();
  });
});

elements.micButton.addEventListener("click", () => {
  if (!recognition) return;
  if (state.recording) {
    recognition.stop();
    return;
  }
  recognition.start();
});

elements.sendButton.addEventListener("click", () => {
  void submitPrompt();
});

elements.textInput.addEventListener("input", autoResize);
elements.textInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    void submitPrompt();
  }
});

async function submitPrompt() {
  const text = elements.textInput.value.trim();
  if (!text || state.isAnimating) return;

  if (state.mode === "high-eq" && !state.region) {
    appendMessage("assistant", "先定一下说话风格吧，选一个地区口吻会更像你们之前那套流程。", "高情商模式");
    renderRegionChooser();
    return;
  }

  appendMessage("user", text, "我");
  elements.textInput.value = "";
  autoResize();
  setLoading(true, "正在生成回复");
  const typingNode = appendMessage("assistant", "", state.mode === "high-eq" ? "高情商模式" : "怼人模式", true);

  try {
    const response = await fetch(new URL("/api/chat", window.location.origin), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: state.mode,
        region: normalizeRegion(state.region),
        text,
        history: flattenHistory()
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "请求失败");
    }

    typingNode?.remove();
    const answerNode = appendMessage("assistant", "", state.mode === "high-eq" ? "高情商模式" : "怼人模式");
    state.history.push(
      { role: "user", content: payload.transcript },
      { role: "assistant", content: payload.answer }
    );
    state.history = state.history.slice(-12);
    elements.voiceHint.textContent = state.mode === "high-eq"
      ? `已进入${state.region || "标准普通话"}风格，可以继续说下一句。`
      : "继续说场景，我会按怼人模式往下接。";

    await animateAssistantReply(answerNode, payload.answer);
    if (state.autoSpeak) speak(payload.answer);
    setLoading(false, "已连接");
  } catch (error) {
    typingNode?.remove();
    const detail = await diagnoseFetchFailure(error);
    appendMessage("assistant", detail, "系统");
    setLoading(false, "连接异常");
  }
}

function flattenHistory() {
  return state.history.slice(-10);
}

function appendMessage(role, content, label, isTyping = false) {
  const item = document.createElement("article");
  item.className = `message ${role}`;
  const bubbleContent = isTyping
    ? '<div class="typing-dots" aria-label="正在生成"><span></span><span></span><span></span></div>'
    : escapeHtml(content).replace(/\n/g, "<br />");
  item.innerHTML = `
    <div class="avatar">${role === "user" ? "我" : "南"}</div>
    <div class="bubble-group">
      <p class="message-name">${escapeHtml(label)}</p>
      <div class="bubble ${isTyping ? "typing-bubble" : ""}">${bubbleContent}</div>
    </div>
  `;
  elements.chatList.appendChild(item);
  item.scrollIntoView({ block: "end", behavior: "smooth" });
  return item;
}

async function animateAssistantReply(node, content) {
  const bubble = node?.querySelector(".bubble");
  if (!bubble) return;
  state.isAnimating = true;
  elements.sendButton.disabled = true;

  bubble.classList.add("streaming");
  bubble.innerHTML = "";

  const tokens = tokenizeForStreaming(content);
  let rendered = "";
  for (let i = 0; i < tokens.length; i += 1) {
    rendered += tokens[i];
    bubble.innerHTML = escapeHtml(rendered).replace(/\n/g, "<br />");
    if (i % 6 === 0) {
      node.scrollIntoView({ block: "end", behavior: "auto" });
      await wait(streamDelay(tokens[i]));
    }
  }

  bubble.classList.remove("streaming");
  state.isAnimating = false;
  elements.sendButton.disabled = false;
}

function tokenizeForStreaming(text) {
  return Array.from(text);
}

function streamDelay(token) {
  if (/[\n]/.test(token)) return 120;
  if (/[，。！？；：,.!?]/.test(token)) return 75;
  if (/\s/.test(token)) return 18;
  return 24;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderRegionChooser() {
  const item = document.createElement("article");
  item.className = "message assistant hero-message";
  item.innerHTML = `
    <div class="avatar">南</div>
    <div class="bubble-group">
      <p class="message-name">地区风格</p>
      <div class="chip-row">
        ${REGION_OPTIONS.map((name) => `<button class="chip-button" data-region="${name}">${name}</button>`).join("")}
      </div>
    </div>
  `;
  elements.chatList.appendChild(item);
  item.querySelectorAll(".chip-button").forEach((button) => {
    button.addEventListener("click", () => {
      chooseRegion(button.dataset.region);
      item.remove();
    });
  });
  item.scrollIntoView({ block: "end", behavior: "smooth" });
}

function chooseRegion(region) {
  state.region = region;
  appendMessage("user", region, "我");
  appendMessage(
    "assistant",
    region === "标准普通话"
      ? "好，后面我就用标准、自然、好出口的话来接。你把场景直接说给我。"
      : `好，后面我就按${region}的说话风格来接。你把场景直接说给我。`,
    "高情商模式"
  );
  state.history = [];
  elements.voiceHint.textContent = `已切到${region}风格，直接说场景就行。`;
  renderQuickPrompts();
}

function normalizeRegion(region) {
  if (!region || region === "标准普通话") return "default";
  return region;
}

function resetConversation() {
  state.history = [];
  state.region = state.mode === "high-eq" ? null : "default";
  elements.chatList.innerHTML = "";
  renderMode();
  renderIntroFlow();
}

function renderIntroFlow() {
  if (state.mode === "high-eq") {
    appendRichIntro({
      label: "高情商模式",
      title: "你现在进的是高情商模式。",
      note: "先选一个地区风格，后面我会一直按这个口吻帮你读场面、接话和稳住气氛。"
    });
    renderRegionChooser();
    return;
  }

  appendRichIntro({
    label: "怼人模式",
    title: "你现在进的是怼人模式。",
    note: "直接把场景丢给我，我给你一句能顶回去、但不越线的话。"
  });
  renderQuickPrompts();
}

function renderMode() {
  const isHighEq = state.mode === "high-eq";
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
  elements.voiceHint.textContent = isHighEq
    ? "先选地区风格，再说场景。识别不准时也可以直接打字。"
    : "主动切到怼人模式后再说，我会给你一句能直接顶回去的话。";
  elements.textInput.placeholder = isHighEq
    ? "比如：领导刚刚这样说，我现在怎么接"
    : "比如：同事又甩锅给我，来一句能顶回去的";
}

function appendRichIntro({ label, title, note }) {
  const item = document.createElement("article");
  item.className = "message assistant hero-message";
  item.innerHTML = `
    <div class="avatar">南</div>
    <div class="bubble-group">
      <p class="message-name">${escapeHtml(label)}</p>
      <div class="bubble intro-bubble">
        <strong>${escapeHtml(title)}</strong>
        <p class="intro-note">${escapeHtml(note)}</p>
      </div>
    </div>
  `;
  elements.chatList.appendChild(item);
  return item;
}

function renderQuickPrompts() {
  const prompts = state.mode === "high-eq"
    ? [
        "领导刚刚这样说，我怎么接",
        "第一次见客户怎么开场",
        "朋友冷场了，我怎么续上"
      ]
    : [
        "同事又甩锅给我",
        "对方阴阳怪气，回一句",
        "客户装腔，怎么顶回去"
      ];

  const item = document.createElement("article");
  item.className = "message assistant hero-message";
  item.innerHTML = `
    <div class="avatar">南</div>
    <div class="bubble-group">
      <p class="message-name">快捷开始</p>
      <div class="quick-row">
        ${prompts.map((text) => `<button class="quick-button" data-text="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("")}
      </div>
    </div>
  `;
  elements.chatList.appendChild(item);
  item.querySelectorAll(".quick-button").forEach((button) => {
    button.addEventListener("click", () => {
      elements.textInput.value = button.dataset.text || "";
      autoResize();
      elements.textInput.focus();
    });
  });
}

function renderRecording() {
  elements.micButton.classList.toggle("is-recording", state.recording);
  elements.networkStatus.textContent = state.recording ? "正在听你说" : "待机中";
}

function setLoading(loading, message) {
  elements.sendButton.disabled = loading;
  elements.networkStatus.textContent = message;
}

async function diagnoseFetchFailure(error) {
  const base = error instanceof Error ? error.message : "请求失败";
  try {
    const response = await fetch(new URL("/api/health", window.location.origin), {
      cache: "no-store"
    });
    if (response.ok) {
      return `${base}\n服务在线，但当前请求没有成功到达聊天接口。请先强制刷新页面后再试。`;
    }
    return `${base}\n服务地址可访问，但健康检查返回异常。`;
  } catch {
    return `${base}\n当前页面没有连到本地服务，请确认你打开的是 npm run dev 打印出来的那个地址。`;
  }
}

function autoResize() {
  elements.textInput.style.height = "24px";
  elements.textInput.style.height = `${Math.min(elements.textInput.scrollHeight, 132)}px`;
}

function speak(text) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/\n/g, " "));
  utterance.lang = "zh-CN";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

renderMode();
renderRecording();
autoResize();
resetConversation();
void checkHealthOnLoad();

async function checkHealthOnLoad() {
  try {
    const response = await fetch(new URL("/api/health", window.location.origin), {
      cache: "no-store"
    });
    if (!response.ok) throw new Error("health not ok");
    elements.networkStatus.textContent = "已连接";
  } catch {
    elements.networkStatus.textContent = "未连服务";
    appendMessage("assistant", "当前页面没有连到本地服务。请重新打开 npm run dev 终端里打印出的那个地址。", "系统");
  }
}
