// ReplayIQ Desktop — Renderer process

const STATUS_CONFIG = {
  fortnite_not_running: { dot: "dot-red",    text: "Fortnite not detected" },
  fortnite_running:     { dot: "dot-yellow", text: "Fortnite running — open a replay to start" },
  replay_detected:      { dot: "dot-green pulse", text: "Replay detected — coaching active" },
  analyzing:            { dot: "dot-blue",   text: "Analyzing gameplay…" },
  error:                { dot: "dot-red",    text: "Error — check connection" },
};

const app = {
  async init() {
    const { status } = await window.electronAPI.getStatus();
    this.applyStatus(status);

    window.electronAPI.onStatusChange((payload) => {
      this.applyStatus(payload.status);
    });

    window.electronAPI.onCoachingResult((result) => {
      this.handleCoachingResult(result);
    });
  },

  applyStatus(status) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;

    const dot = document.getElementById("status-dot");
    dot.className = "status-dot " + cfg.dot;
    document.getElementById("status-text").textContent = cfg.text;

    const captureBtn = document.getElementById("manual-capture-btn");
    if (status === "replay_detected") {
      captureBtn.classList.add("visible");
    } else {
      captureBtn.classList.remove("visible");
    }

    const feed = document.getElementById("feed");

    // Show/hide analyzing spinner
    const existing = feed.querySelector(".analyzing-card");
    if (status === "analyzing" && !existing) {
      const spinner = document.createElement("div");
      spinner.className = "analyzing-card";
      spinner.innerHTML = `
        <div class="spinner"></div>
        <div class="analyzing-text">Analyzing gameplay frame…</div>
      `;
      feed.prepend(spinner);
    } else if (status !== "analyzing" && existing) {
      existing.remove();
    }

    // Show idle message if feed is empty
    if (!feed.querySelector(".coaching-card, .analyzing-card")) {
      this.showIdleMessage(status);
    }
  },

  showIdleMessage(status) {
    const feed = document.getElementById("feed");
    const existing = feed.querySelector(".idle-box");
    if (existing) existing.remove();

    const icons = {
      fortnite_not_running: "🎮",
      fortnite_running: "📺",
      replay_detected: "🎬",
    };

    const msgs = {
      fortnite_not_running: { title: "Open Fortnite", body: "Launch Fortnite and open a replay from the Career tab." },
      fortnite_running:     { title: "Open a replay", body: "In Fortnite, go to Career → Replays and open any match replay." },
      replay_detected:      { title: "Coaching active", body: "ReplayIQ is watching. Coaching results will appear here every 30 seconds." },
    };

    const m = msgs[status];
    if (!m) return;

    const box = document.createElement("div");
    box.className = "idle-box";
    box.innerHTML = `
      <div class="idle-icon">${icons[status] || "🎮"}</div>
      <h3>${m.title}</h3>
      <p>${m.body}</p>
    `;
    feed.appendChild(box);
  },

  handleCoachingResult(result) {
    const feed = document.getElementById("feed");
    feed.querySelectorAll(".idle-box").forEach((el) => el.remove());

    if (result.type === "rate_limited") {
      this.addRateLimitCard(result.message);
      return;
    }
    if (result.type === "error") {
      this.addErrorCard(result.message);
      return;
    }
    if (result.type === "coaching" && result.data) {
      this.addCoachingCard(result.data);
    }

    const cards = feed.querySelectorAll(".coaching-card, .rate-limit-card");
    if (cards.length > 5) cards[cards.length - 1].remove();
  },

  addCoachingCard(data) {
    const feed = document.getElementById("feed");
    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const mistakesHtml = (data.mistakes || [])
      .map((m) => `
        <div class="mistake ${m.severity}">
          <div class="mistake-header">
            <span class="sev-badge badge-${m.severity}">${m.severity}</span>
            <span class="mistake-title">${escHtml(m.title)}</span>
          </div>
          <div class="mistake-desc">${escHtml(m.description)}</div>
          <div class="fix-box">
            <div class="fix-label">What to do instead</div>
            ${escHtml(m.suggestion)}
          </div>
        </div>
      `)
      .join("");

    const positivesHtml =
      data.positives && data.positives.length > 0
        ? `<div class="positives-section">
            <div class="positives-label">✓ What you did well</div>
            ${data.positives.map((p) => `<div class="positive-item">${escHtml(p)}</div>`).join("")}
           </div>`
        : "";

    const card = document.createElement("div");
    card.className = "coaching-card";
    card.innerHTML = `
      <div class="card-header">
        <span style="font-size:11px;font-weight:600;color:#94a3b8">AI Coaching</span>
        <span class="card-time">${time}</span>
      </div>
      <div class="card-body">
        <div class="observation">${escHtml(data.observation)}</div>
        ${mistakesHtml}
        ${positivesHtml}
      </div>
    `;
    feed.prepend(card);
  },

  addRateLimitCard(message) {
    const feed = document.getElementById("feed");
    const card = document.createElement("div");
    card.className = "rate-limit-card";
    card.innerHTML = `<p>⏱ ${escHtml(message || "Please wait 30 seconds between analyses.")}</p>`;
    feed.prepend(card);
  },

  addErrorCard(message) {
    const feed = document.getElementById("feed");
    const card = document.createElement("div");
    card.className = "coaching-card";
    card.style.borderColor = "rgba(239,68,68,0.3)";
    card.innerHTML = `
      <div class="card-body">
        <div style="color:#f87171;font-size:12px;">⚠ ${escHtml(message || "Analysis failed")}</div>
      </div>
    `;
    feed.prepend(card);
    setTimeout(() => card.remove(), 8000);
  },

  async manualCapture() {
    const btn = document.getElementById("manual-capture-btn");
    btn.textContent = "Analyzing…";
    btn.disabled = true;
    await window.electronAPI.manualCapture();
    btn.textContent = "▶ Analyze Now";
    btn.disabled = false;
  },
};

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

app.init();
