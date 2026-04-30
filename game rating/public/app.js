const reviewForm = document.getElementById("reviewForm");
const gameNameInput = document.getElementById("gameNameInput");
const generateBtn = document.getElementById("generateBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const statusText = document.getElementById("statusText");
const resultSection = document.getElementById("resultSection");
const historyList = document.getElementById("historyList");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

let currentGameName = "";

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
  const degree = Math.max(0, Math.min(100, finalScore)) * 3.6;

  resultSection.classList.remove("empty");

  resultSection.innerHTML = `
    <div class="report">
      <div class="report-top">
        <div class="report-title">
          <h2>${escapeHtml(report.gameName)}</h2>
          <div class="meta">
            生成时间：${escapeHtml(formatDate(report.createdAt))}
            ${
              cached
                ? `<span class="badge">本地缓存</span>`
                : `<span class="badge">AI 新生成</span>`
            }
          </div>
        </div>

        <div class="score-circle" style="--score-deg:${degree}deg;">
          <div class="score-inner">
            <div class="score-num">${escapeHtml(finalScore)}</div>
            <div class="score-label">综合评分 / 100</div>
          </div>
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

    const items = result.data || [];

    if (!items.length) {
      historyList.innerHTML = `<p class="history-meta">暂无历史记录。</p>`;
      return;
    }

    historyList.innerHTML = items
      .map((item, index) => {
        return `
          <div class="history-item" data-index="${index}">
            <button class="history-item-main" type="button">
              <div class="history-name">${escapeHtml(item.gameName)}</div>
              <div class="history-meta">
                ${escapeHtml(item.finalScore)} / 100 · ${escapeHtml(
          formatDate(item.createdAt)
        )}
              </div>
            </button>
            <button class="delete-btn" data-index="${index}" type="button" title="删除">✕</button>
          </div>
        `;
      })
      .join("");

    document.querySelectorAll(".history-item-main").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = Number(btn.parentElement.dataset.index);
        const item = items[index];

        if (item) {
          gameNameInput.value = item.gameName;
          renderReport(item, true);
          statusText.textContent = "已加载本地历史评分。";
        }
      });
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (event) => {
        event.stopPropagation();
        const index = Number(btn.dataset.index);
        const item = items[index];

        if (!item) return;

        if (!confirm(`确定要删除《${item.gameName}》的评分记录吗？`)) return;

        try {
          const response = await fetch(`/api/review/${encodeURIComponent(item.gameName)}`, {
            method: "DELETE"
          });
          const result = await response.json();

          if (!result.success) {
            throw new Error(result.message);
          }

          if (currentGameName === item.gameName) {
            resultSection.classList.add("empty");
            resultSection.innerHTML = `
              <div class="empty-state">
                <div class="empty-icon">🎮</div>
                <h2>等待生成评分</h2>
                <p>生成结果会显示在这里。</p>
              </div>
            `;
            currentGameName = "";
            regenerateBtn.hidden = true;
          }

          statusText.textContent = result.message;
          await loadHistory();
        } catch (error) {
          statusText.textContent = error.message || "删除失败";
        }
      });
    });
  } catch (error) {
    historyList.innerHTML = `<p class="history-meta">${escapeHtml(
      error.message || "读取历史失败"
    )}</p>`;
  }
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

loadHistory();