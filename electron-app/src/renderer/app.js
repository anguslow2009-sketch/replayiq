// ReplayIQ Desktop — Renderer process
// Communicates with main process via window.electronAPI (contextBridge)

const STATUS_CONFIG = {
  no_token:            { dot: "dot-gray",   text: "Not connected — paste your token below" },
  fortnite_not_running:{ dot: "dot-red",    text: "Fortnite not detected" },
  fortnite_running:    { dot: "dot-yellow", text: "Fortnite running — open a replay to start" },
  replay_detected:     { dot: "dot-green pulse", text: "Replay detected — coaching active" },
  analyzing:           { dot: "dot-blue",   text: "Analyzing gameplay…" },
  error:               { dot: "dot-red",    text: "Error — check connection" },
};

const app = {
  // ── Init ──────────────────────────────────────────────────────────────────
  async init() {
    const { status, hasToken } = await window.electronAPI.getStatus();
    this.applyStatus(status, hasToken);

    // Listen for status changes from main process
    window.electronAPI.onStatusChange((payload) => {
      this.applyStatus(payload.status, payload.authenticated ?? null);
    });

    // Listen for coaching results
    window.electronAPI.onCoachingResult((result) => {
      this.handleCoachingResult(result);
    });
  },

  // ── Status ────────────────────────────────────────────────────────────────
  applyStatus(status, hasToken) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;

    // Update dot
    const dot = document.getElementById("status-dot");
    dot.className = "status-dot " + cfg.dot;

    // Update text
    document.getElementById("status-text").textContent = cfg.text;

    // Show/hide manual capture button
    const captureBtn = document.getElementById("manual-capture-btn");
    if (status === "replay_detected") {
      captureBtn.classList.add("visible");
    } else {
      captureBtn.classList.remove("visible");
    }

    // Show auth or feed
    const authScreen = document.getElementById("auth-screen");
    const feed = document.getElementById("feed");
    const signOutBtn = document.getElementById("sign-out-btn");

    if (status === "no_token" || hasToken === false) {
      authScreen.style.display = "flex";
      feed.style.display = "none";
      signOutBtn.style.display = "none";
    } else {
      authScreen.style.display = "none";
      feed.style.display = "block";
      signOutBtn.style.display = "block";

      // Show idle message if feed is empty
      if (!feed.querySelector(".coaching-card, .analyzing-card")) {
        this.showIdleMessage(status);
      }
    }

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
  },

  showIdleMessage(status) {
    const feed = document.getElementById("feed");
    const existing = feed.querySelector(".idle-box");
    if (existing) return;

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

  // ── Coaching results ──────────────────────────────────────────────────────
  handleCoachingResult(result) {
    const feed = document.getElementById("feed");

    // Remove idle boxes
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

    // Keep only the 5 most recent cards
    const cards = feed.querySelectorAll(".coaching-card, .rate-limit-card");
    if (cards.length > 5) {
      cards[cards.length - 1].remove();
    }
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
    card.innerHTML = `
      <p>⏱ ${escHtml(message || "Daily coaching limit reached. Resets at midnight.")}</p>
      <button class="btn-primary" onclick="window.electronAPI.openWebsite('/pricing')" style="margin:0 auto;display:block">
        Upgrade to Pro
      </button>
    `;
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

  // ── Auth ──────────────────────────────────────────────────────────────────
  async submitToken() {
    const input = document.getElementById("token-input");
    const token = input.value.trim();
    if (!token) return;

    const ok = await window.electronAPI.setToken(token);
    if (ok) {
      input.value = "";
    }
  },

  async signOut() {
    await window.electronAPI.signOut();
    document.getElementById("feed").innerHTML = "";
  },

  // ── Manual capture ────────────────────────────────────────────────────────
  async manualCapture() {
    const btn = document.getElementById("manual-capture-btn");
    btn.textContent = "Analyzing…";
    btn.disabled = true;
    await window.electronAPI.manualCapture();
    btn.textContent = "▶ Analyze Now";
    btn.disabled = false;
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Allow pressing Enter in token input
document.getElementById("token-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") app.submitToken();
});

// Boot
app.init();
