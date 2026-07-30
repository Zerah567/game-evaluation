const reviewForm = document.getElementById("reviewForm");
const gameNameInput = document.getElementById("gameNameInput");
const developerInput = document.getElementById("developerInput");
const gameLinkInput = document.getElementById("gameLinkInput");
const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const statusText = document.getElementById("statusText");
const resultSection = document.getElementById("resultSection");
const historyList = document.getElementById("historyList");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const knowledgeList = document.getElementById("knowledgeList");
const refreshKnowledgeBtn = document.getElementById("refreshKnowledgeBtn");
const exportBtn = document.getElementById("exportBtn");
const historySearch = document.getElementById("historySearch");
const knowledgeSearch = document.getElementById("knowledgeSearch");
const historyMoreBtn = document.getElementById("historyMoreBtn");
const knowledgeMoreBtn = document.getElementById("knowledgeMoreBtn");

const PAGE_SIZE = 20;

let currentGameName = "";
let allHistoryItems = [];
let allKnowledgeEntries = [];
let historyDisplayCount = 0;
let knowledgeDisplayCount = 0;

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function setLoading(isLoading, text = "") {
  generateBtn.disabled = isLoading;
  regenerateBtn.disabled = isLoading;
  gameNameInput.disabled = isLoading;
  developerInput.disabled = isLoading;
  gameLinkInput.disabled = isLoading;
  statusText.textContent = text;

  if (isLoading) {
    generateBtn.textContent = "生成中...";
  } else {
    generateBtn.textContent = "生成评分";
  }
}

function getScoreClass(score) {
  if (score >= 80) return "high";
  if (score >= 60) return "mid";
  return "low";
}

function getSafeExternalUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderLeafNode(node) {
  return `
    <div class="child-item">
      <div class="child-top">
        <span>${escapeHtml(node.name)}</span>
        <strong>${escapeHtml(node.score100)} / 100</strong>
      </div>
      <div class="progress">
        <span style="width:${Math.max(0, Math.min(100, node.score100))}%"></span>
      </div>
      ${
        node.reason
          ? `<div class="reason">${escapeHtml(node.reason)}</div>`
          : ""
      }
    </div>
  `;
}

function renderSecondLevelNode(node) {
  const children = node.children || [];

  return `
    <div class="child-item">
      <div class="child-top">
        <span>${escapeHtml(node.name)}</span>
        <strong>${escapeHtml(node.score100)} / 100</strong>
      </div>
      <div class="progress">
        <span style="width:${Math.max(0, Math.min(100, node.score100))}%"></span>
      </div>

      ${
        children.length
          ? `<div class="child-list" style="padding:12px 0 0;">
              ${children.map(renderLeafNode).join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderDimensionCard(dimension) {
  const children = dimension.children || [];

  return `
    <div class="dimension-card">
      <div class="dimension-main">
        <div class="dimension-row">
          <div class="dimension-name">${escapeHtml(dimension.name)}</div>
          <div class="dimension-score">${escapeHtml(dimension.score100)} / 100</div>
        </div>
        <div class="progress">
          <span style="width:${Math.max(
            0,
            Math.min(100, dimension.score100)
          )}%"></span>
        </div>
      </div>

      ${
        children.length
          ? `<div class="child-list">
              ${children.map(renderSecondLevelNode).join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderReport(report, cached = false) {
  currentGameName = report.gameName || "";
  regenerateBtn.hidden = false;

  const finalScore = Number(report.finalScore || 0);
  const scoreWidth = Math.max(0, Math.min(100, finalScore));
  const safeGameUrl = getSafeExternalUrl(report.gameUrl);

  resultSection.classList.remove("empty");

  resultSection.innerHTML = `
    <div class="report">
      <div class="report-top">
        <div class="report-title">
          <p class="section-index">评估结果</p>
          <h2>${escapeHtml(report.gameName)}</h2>
          <div class="meta">
            生成时间：${escapeHtml(formatDate(report.createdAt))}
            ${
              cached
                ? `<span class="badge">本地缓存</span>`
                : `<span class="badge">AI 新生成</span>`
            }
          </div>
          ${
            report.developer || safeGameUrl
              ? `<div class="reference-meta">
                  ${
                    report.developer
                      ? `<span>开发商：${escapeHtml(report.developer)}</span>`
                      : ""
                  }
                  ${
                    safeGameUrl
                      ? `<a href="${escapeHtml(safeGameUrl)}" target="_blank" rel="noopener noreferrer">查看参考链接</a>`
                      : ""
                  }
                </div>`
              : ""
          }
        </div>

        <div class="score-block">
          <div class="score-num">${escapeHtml(finalScore)}</div>
          <div class="score-label">综合评分 / 100</div>
          <div class="score-scale"><span style="width:${scoreWidth}%"></span></div>
        </div>
      </div>

      <div class="comment">
        <strong>简短评语：</strong>
        ${escapeHtml(report.shortComment)}
      </div>

      <div class="dimension-list">
        ${(report.dimensions || []).map(renderDimensionCard).join("")}
      </div>
    </div>
  `;
}

async function generateReview(force = false) {
  const gameName = gameNameInput.value.trim();
  const developer = developerInput.value.trim();
  const gameUrl = gameLinkInput.value.trim();

  if (!gameName) {
    statusText.textContent = "请输入游戏名称。";
    gameNameInput.focus();
    return;
  }

  setLoading(true, force ? "正在重新生成评分，请稍候..." : "正在生成评分，请稍候...");

  try {
    const response = await fetch("/api/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        gameName,
        developer,
        gameUrl,
        force
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "生成失败");
    }

    renderReport(result.data, result.cached);

    statusText.textContent = result.cached
      ? "已从本地历史记录读取评分。"
      : "评分生成成功，并已保存到本地。";

    await loadHistory();
    await loadKnowledge();
  } catch (error) {
    statusText.textContent = error.message || "生成评分失败，请稍后重试。";
  } finally {
    setLoading(false, statusText.textContent);
  }
}

async function loadHistory() {
  historyList.innerHTML = `<p class="history-meta">正在加载...</p>`;

  try {
    const response = await fetch("/api/history");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "读取历史失败");
    }

    allHistoryItems = result.data || [];

    if (!allHistoryItems.length) {
      historyList.innerHTML = `<p class="history-meta">暂无历史记录。</p>`;
      historyMoreBtn.hidden = true;
      return;
    }

    renderHistory();
  } catch (error) {
    historyList.innerHTML = `<p class="history-meta">${escapeHtml(
      error.message || "读取历史失败"
    )}</p>`;
  }
}

function renderHistory() {
  const keyword = (historySearch.value || "").trim().toLowerCase();
  const filtered = keyword
    ? allHistoryItems.filter((item) =>
        (item.gameName || "").toLowerCase().includes(keyword)
      )
    : allHistoryItems;

  if (historyDisplayCount === 0) {
    historyDisplayCount = PAGE_SIZE;
  }

  const showCount = Math.min(historyDisplayCount, filtered.length);
  const visibleItems = filtered.slice(0, showCount);

  if (!filtered.length) {
    historyList.innerHTML = `<p class="history-meta">未找到匹配的记录。</p>`;
    historyMoreBtn.hidden = true;
    return;
  }

  historyList.innerHTML = visibleItems
    .map((item, index) => {
      const originalIndex = allHistoryItems.indexOf(item);
      return `
          <div class="history-item" data-original-index="${originalIndex}">
            <button class="history-item-main" type="button">
              <div class="history-name">${escapeHtml(item.gameName)}</div>
              <div class="history-meta">
                ${escapeHtml(item.finalScore)} / 100 · ${escapeHtml(
          formatDate(item.createdAt)
        )}
              </div>
            </button>
            <button class="delete-btn" data-original-index="${originalIndex}" type="button" title="删除">✕</button>
          </div>
        `;
    })
    .join("");

  historyMoreBtn.hidden = showCount >= filtered.length;

  document.querySelectorAll(".history-item-main").forEach((btn) => {
    btn.addEventListener("click", () => {
      const originalIndex = Number(btn.parentElement.dataset.originalIndex);
      const item = allHistoryItems[originalIndex];

      if (item) {
        gameNameInput.value = item.gameName;
        developerInput.value = item.developer || "";
        gameLinkInput.value = item.gameUrl || "";
        renderReport(item, true);
        statusText.textContent = "已加载本地历史评分。";
      }
    });
  });

  document.querySelectorAll(".history-item .delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const originalIndex = Number(btn.dataset.originalIndex);
      const item = allHistoryItems[originalIndex];

      if (!item) return;

      if (!confirm(`确定要删除《${item.gameName}》的评分记录吗？`)) return;

      try {
        const response = await fetch(`/api/review/${encodeURIComponent(item.gameName)}`, {
          method: "DELETE"
        });
        const delResult = await response.json();

        if (!delResult.success) {
          throw new Error(delResult.message);
        }

        if (currentGameName === item.gameName) {
          resultSection.classList.add("empty");
          resultSection.innerHTML = `
              <div class="empty-state">
                <span class="empty-number">00</span>
                <div>
                  <p class="section-index">等待输入</p>
                  <h2>开始一份新的<br />游戏评估简报。</h2>
                </div>
              </div>
            `;
          currentGameName = "";
          regenerateBtn.hidden = true;
        }

        statusText.textContent = delResult.message;
        historyDisplayCount = 0;
        await loadHistory();
      } catch (error) {
        statusText.textContent = error.message || "删除失败";
      }
    });
  });
}

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  generateReview(false);
});

regenerateBtn.addEventListener("click", () => {
  if (currentGameName) {
    gameNameInput.value = currentGameName;
  }

  generateReview(true);
});

refreshHistoryBtn.addEventListener("click", loadHistory);

async function loadKnowledge() {
  knowledgeList.innerHTML = `<p class="history-meta">正在加载...</p>`;

  try {
    const response = await fetch("/api/knowledge");
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "读取知识库失败");
    }

    allKnowledgeEntries = Object.entries(result.data || {});

    if (!allKnowledgeEntries.length) {
      knowledgeList.innerHTML = `<p class="history-meta">暂无游戏知识，生成评分后自动积累。</p>`;
      const knowledgeHeader = document.getElementById("knowledgeTitle");
      if (knowledgeHeader) {
        knowledgeHeader.textContent = "游戏知识库";
      }
      knowledgeMoreBtn.hidden = true;
      return;
    }

    const knowledgeHeader = document.getElementById("knowledgeTitle");
    if (knowledgeHeader) {
      knowledgeHeader.textContent = `游戏知识库（${allKnowledgeEntries.length} 条）`;
    }

    renderKnowledge();
  } catch (error) {
    knowledgeList.innerHTML = `<p class="history-meta">${escapeHtml(
      error.message || "读取知识库失败"
    )}</p>`;
  }
}

function renderKnowledge() {
  const keyword = (knowledgeSearch.value || "").trim().toLowerCase();
  const filtered = keyword
    ? allKnowledgeEntries.filter(
        ([key, value]) =>
          key.toLowerCase().includes(keyword) ||
          (value.genre || "").toLowerCase().includes(keyword)
      )
    : allKnowledgeEntries;

  if (knowledgeDisplayCount === 0) {
    knowledgeDisplayCount = PAGE_SIZE;
  }

  const showCount = Math.min(knowledgeDisplayCount, filtered.length);
  const visibleEntries = filtered.slice(0, showCount);

  if (!filtered.length) {
    knowledgeList.innerHTML = `<p class="history-meta">未找到匹配的知识。</p>`;
    knowledgeMoreBtn.hidden = true;
    return;
  }

  const knowledgeHeader = document.getElementById("knowledgeTitle");
  if (knowledgeHeader) {
    const total = keyword ? `${visibleEntries.length}/${filtered.length}` : String(allKnowledgeEntries.length);
    knowledgeHeader.textContent = `游戏知识库${keyword ? `（搜索 ${total} 条）` : `（${total} 条）`}`;
  }

  knowledgeList.innerHTML = visibleEntries
    .map(([key, value]) => {
      const facts = (value.knownFacts || []).join("、");
      return `
          <div class="knowledge-item" data-key="${escapeHtml(key)}">
            <button class="knowledge-item-main" type="button">
              <div class="history-name">${escapeHtml(key)}</div>
              <div class="history-meta">
                ${escapeHtml(value.genre || "未知类型")}
                ${facts ? `· ${escapeHtml(facts)}` : ""}
              </div>
            </button>
            <button class="delete-btn knowledge-delete" data-key="${escapeHtml(key)}" type="button" title="删除知识">✕</button>
          </div>
        `;
    })
    .join("");

  knowledgeMoreBtn.hidden = showCount >= filtered.length;

  document.querySelectorAll(".knowledge-item-main").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const key = btn.parentElement.dataset.key;
      const entry = allKnowledgeEntries.find(([k]) => k === key)?.[1];
      if (!entry) return;

      const description = entry.description || "（暂无简介）";
      const facts = (entry.knownFacts || []).map((f, i) => `${i + 1}. ${f}`).join("\n");
      const newFacts = prompt(
        `正在查看/编辑《${key}》的知识\n\n类型：${entry.genre || "未知"}\n简介：${description}\n\n已知事实：\n${facts || "（暂无）"}\n\n如需补充新事实，请用逗号分隔输入：`,
        (entry.knownFacts || []).join("，")
      );

      if (newFacts === null) return;

      const factList = newFacts.split(/[，,、]/).map((s) => s.trim()).filter(Boolean);

      const saveResponse = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName: key,
          genre: entry.genre,
          description: entry.description,
          knownFacts: factList
        })
      });

      const saveResult = await saveResponse.json();
      if (saveResult.success) {
        statusText.textContent = saveResult.message;
        knowledgeDisplayCount = 0;
        await loadKnowledge();
      } else {
        statusText.textContent = saveResult.message || "保存失败";
      }
    });
  });

  document.querySelectorAll(".knowledge-delete").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const key = btn.dataset.key;
      if (!confirm(`确定要删除《${key}》的知识吗？`)) return;

      const delResponse = await fetch(`/api/knowledge/${encodeURIComponent(key)}`, {
        method: "DELETE"
      });
      const delResult = await delResponse.json();

      if (delResult.success) {
        statusText.textContent = delResult.message;
        knowledgeDisplayCount = 0;
        await loadKnowledge();
      } else {
        statusText.textContent = delResult.message || "删除失败";
      }
    });
  });
}

refreshKnowledgeBtn.addEventListener("click", loadKnowledge);

async function exportData() {
  const password = prompt("请输入导出密码：");
  if (password === null) return;

  try {
    const response = await fetch(`/api/export?token=${encodeURIComponent(password)}`);

    if (response.status === 403) {
      throw new Error("密码错误，无权导出");
    }

    if (!response.ok) throw new Error("导出失败");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-rating-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    statusText.textContent = "数据已导出。";
  } catch (error) {
    statusText.textContent = error.message || "导出数据失败";
  }
}

exportBtn.addEventListener("click", exportData);

let searchTimer;
historySearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    historyDisplayCount = 0;
    renderHistory();
  }, 300);
});

knowledgeSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    knowledgeDisplayCount = 0;
    renderKnowledge();
  }, 300);
});

historyMoreBtn.addEventListener("click", () => {
  historyDisplayCount += PAGE_SIZE;
  renderHistory();
});

knowledgeMoreBtn.addEventListener("click", () => {
  knowledgeDisplayCount += PAGE_SIZE;
  renderKnowledge();
});

loadHistory();
loadKnowledge();
