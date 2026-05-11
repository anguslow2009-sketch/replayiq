// ReplayIQ Desktop — Full App

const STATUS_CONFIG = {
  fortnite_not_running: { dot: "dot-gray",   text: "Fortnite not running",       banner: { icon: "🎮", title: "Open Fortnite to begin", desc: "Launch Fortnite and open a replay from Career → Replays" } },
  fortnite_running:     { dot: "dot-yellow", text: "Fortnite running",            banner: { icon: "📺", title: "Fortnite detected", desc: "Go to Career → Replays and open a match to start coaching" } },
  replay_detected:      { dot: "dot-green",  text: "Replay active — coaching on", banner: { icon: "🎬", title: "Replay detected!", desc: "AI coaching is active — results appear every 30 seconds" } },
  analyzing:            { dot: "dot-blue",   text: "Analyzing…",                  banner: { icon: "🔍", title: "Analyzing your gameplay…", desc: "Claude is reviewing your replay frame right now" } },
  error:                { dot: "dot-red",    text: "Connection error",             banner: { icon: "⚠️", title: "Connection issue", desc: "Check your internet and try again" } },
};

const app = {
  currentPage: "dashboard",
  currentStatus: "fortnite_not_running",
  sessionStats: null,
  chatHistory: [],
  sessionTimer: null,
  sessionStart: null,
  settings: {},

  // ── Boot ──────────────────────────────────────────────────────────────────
  async init() {
    // Load settings first
    this.settings = await window.electronAPI.getSettings();
    this.applySettingsToUI();

    // Get initial status
    const { status } = await window.electronAPI.getStatus();
    this.applyStatus(status);

    // Load history and sessions
    await this.refreshHistory();
    await this.refreshDashboard();

    // Listen for events
    window.electronAPI.onStatusChange((payload) => {
      this.applyStatus(payload.status);
    });

    window.electronAPI.onCoachingResult((result) => {
      this.handleCoachingResult(result);
    });

    window.electronAPI.onSessionUpdate((stats) => {
      this.sessionStats = stats;
      this.updateSessionStrip(stats);
      this.updateSkillBars(stats.skillAverages);
      this.updateWeaknessCard();
    });

    // Interval to update session timer
    this.sessionTimer = setInterval(() => this.tickSessionTimer(), 1000);

    // Setup settings interval slider
    document.getElementById("setting-interval").addEventListener("input", (e) => {
      document.getElementById("interval-display").textContent = e.target.value + "s";
    });

    // Setup focus area checkboxes
    document.querySelectorAll(".checkbox-pill").forEach((pill) => {
      const cb = pill.querySelector("input");
      cb.addEventListener("change", () => {
        pill.classList.toggle("checked", cb.checked);
      });
    });

    // Enter key in chat
    document.getElementById("chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendChat();
      }
    });

    // Hide loading, show app
    setTimeout(() => {
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("app").style.display = "flex";
    }, 600);

    // Update greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    document.getElementById("dash-greeting").textContent = greeting + ", let's get better";
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  navigate(page) {
    this.currentPage = page;

    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-" + page)?.classList.add("active");

    document.querySelectorAll(".nav-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.page === page);
    });

    if (page === "history") this.refreshHistory();
    if (page === "dashboard") this.refreshDashboard();
  },

  // ── Status ────────────────────────────────────────────────────────────────
  applyStatus(status) {
    this.currentStatus = status;
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.error;

    // Title bar pill
    const dot = document.getElementById("status-dot");
    dot.className = cfg.dot;
    document.getElementById("status-text").textContent = cfg.text;

    // Live badge in nav
    const liveBadge = document.getElementById("live-badge");
    liveBadge.classList.toggle("active", status === "replay_detected" || status === "analyzing");

    // Dashboard banner
    if (cfg.banner) {
      document.getElementById("banner-icon").textContent = cfg.banner.icon;
      document.getElementById("banner-title").textContent = cfg.banner.title;
      document.getElementById("banner-desc").textContent = cfg.banner.desc;
    }

    // Live page status card
    this.updateLiveStatus(status);

    // Show/hide analyzing banner
    const analyzingBanner = document.getElementById("analyzing-banner");
    analyzingBanner.style.display = status === "analyzing" ? "flex" : "none";

    // Force analyze button
    const forceBtn = document.getElementById("force-btn");
    if (forceBtn) forceBtn.disabled = status === "analyzing";
    const forceAnalyzeBtn = document.getElementById("force-analyze-btn");
    if (forceAnalyzeBtn) forceAnalyzeBtn.disabled = status === "analyzing";

    // Session strip
    if (status === "replay_detected" || status === "analyzing") {
      if (!this.sessionStart) this.sessionStart = Date.now();
      document.getElementById("session-strip").style.display = "flex";
    }

    // Sidebar session
    this.updateSidebarSession();
  },

  updateLiveStatus(status) {
    const el = document.getElementById("live-status-content");
    const icons = {
      fortnite_not_running: "🎮",
      fortnite_running: "📺",
      replay_detected: "🎬",
      analyzing: "🔍",
      error: "⚠️",
    };
    const msgs = {
      fortnite_not_running: { title: "Fortnite not running", desc: "Launch Fortnite and open a replay to start coaching." },
      fortnite_running: { title: "Fortnite detected — not in replay", desc: "Go to Career → Replays, open any match replay. ReplayIQ will auto-detect it." },
      replay_detected: { title: "Replay active — coaching running", desc: "AI is analyzing your gameplay every 30 seconds. Results will appear below." },
      analyzing: { title: "Analyzing right now…", desc: "Claude is reviewing your gameplay frame. Hold tight." },
      error: { title: "Connection error", desc: "Could not reach the coaching server. Check your internet connection." },
    };

    const m = msgs[status] || msgs.error;
    const dotColor = { fortnite_not_running: "var(--muted)", fortnite_running: "var(--yellow)", replay_detected: "var(--green)", analyzing: "var(--blue)", error: "var(--red)" };

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:26px">${icons[status] || "⚠️"}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${m.title}</div>
          <div style="font-size:11px;color:var(--muted)">${m.desc}</div>
        </div>
        <div style="width:10px;height:10px;border-radius:50%;background:${dotColor[status] || "var(--muted)"};${status === "replay_detected" ? "animation:pulse 2s infinite" : ""}"></div>
      </div>
    `;
  },

  updateSidebarSession() {
    const el = document.getElementById("sidebar-session-stats");
    if (!this.sessionStats) {
      el.innerHTML = `<span style="color:var(--muted2)">No active session</span>`;
      return;
    }
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;justify-content:space-between"><span>Frames</span><span style="font-weight:700">${this.sessionStats.analyses}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Mistakes</span><span style="font-weight:700;color:var(--red)">${this.sessionStats.mistakes}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Good plays</span><span style="font-weight:700;color:var(--green)">${this.sessionStats.positives}</span></div>
      </div>
    `;
  },

  // ── Coaching results ──────────────────────────────────────────────────────
  handleCoachingResult(result) {
    if (result.type === "rate_limited") {
      this.addLiveCard("rate_limited", result.message);
      return;
    }
    if (result.type === "error") {
      this.addLiveCard("error", result.message);
      return;
    }
    if (result.type === "coaching" && result.data) {
      this.addCoachingCard(result.data);
      this.refreshDashboard();
    }
  },

  addCoachingCard(data) {
    const feed = document.getElementById("live-feed");
    feed.querySelectorAll(".idle-state").forEach((el) => el.remove());

    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const mistakeCount = (data.mistakes || []).length;
    const positiveCount = (data.positives || []).length;

    const mistakesHtml = (data.mistakes || []).map((m) => `
      <div class="mistake-card ${m.severity}">
        <div class="mistake-header">
          <span class="sev-badge ${m.severity}">${m.severity}</span>
          <span class="cat-badge">${(m.category || "").replace(/_/g," ")}</span>
          <span class="mistake-title">${escHtml(m.title)}</span>
        </div>
        <div class="mistake-desc">${escHtml(m.description)}</div>
        ${m.why_bad || m.what_pros_do ? `
        <div class="insight-row">
          ${m.why_bad ? `<div class="insight-box why"><div class="insight-label">Why This Costs You</div><div class="insight-text">${escHtml(m.why_bad)}</div></div>` : ""}
          ${m.what_pros_do ? `<div class="insight-box pro"><div class="insight-label">What Pros Do Instead</div><div class="insight-text">${escHtml(m.what_pros_do)}</div></div>` : ""}
        </div>` : ""}
        ${m.suggestion ? `<div class="suggestion-box"><div class="suggestion-label">Fix It Now</div><div class="suggestion-text">${escHtml(m.suggestion)}</div></div>` : ""}
      </div>
    `).join("");

    const positivesHtml = (data.positives || []).map((p) => `
      <div class="positive-card">
        <div class="positive-check">✓</div>
        <div>
          <div class="positive-title">${escHtml(p.title || p)}</div>
          ${p.description ? `<div class="positive-desc">${escHtml(p.description)}</div>` : ""}
        </div>
      </div>
    `).join("");

    const gamePhase = data.game_state?.phase ? `<span style="font-size:11px;background:rgba(255,255,255,0.06);border-radius:5px;padding:2px 8px;margin-left:8px">${data.game_state.phase} game</span>` : "";

    const card = document.createElement("div");
    card.className = "analysis-card";
    card.style.marginBottom = "16px";
    card.innerHTML = `
      <div class="analysis-card-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12px;font-weight:700;color:var(--blue)">⚡ AI Coaching</span>
          ${gamePhase}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:11px;color:var(--muted)">${time}</span>
          <span style="font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(239,68,68,0.1);color:var(--red)">${mistakeCount} mistake${mistakeCount !== 1 ? "s" : ""}</span>
          ${positiveCount > 0 ? `<span style="font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(34,197,94,0.1);color:var(--green)">${positiveCount} good</span>` : ""}
        </div>
      </div>
      <div class="analysis-card-body">
        <div class="observation-text">${escHtml(data.observation)}</div>
        ${mistakesHtml}
        ${positivesHtml ? `<div style="margin-top:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--green);margin-bottom:6px">✓ What You Did Well</div>${positivesHtml}` : ""}
      </div>
    `;

    feed.prepend(card);

    // Keep only last 5 cards
    const cards = feed.querySelectorAll(".analysis-card");
    if (cards.length > 5) cards[cards.length - 1].remove();

    // Auto-navigate to live tab if not already there
    if (this.currentPage !== "live") {
      const liveBadge = document.getElementById("live-badge");
      liveBadge.classList.add("active");
    }
  },

  addLiveCard(type, message) {
    const feed = document.getElementById("live-feed");
    const card = document.createElement("div");
    card.style.cssText = "margin-bottom:10px;animation:slideUp 0.3s ease-out";

    if (type === "rate_limited") {
      card.innerHTML = `<div class="card" style="border-color:rgba(234,179,8,0.2);background:rgba(234,179,8,0.04);padding:12px 16px">
        <div style="color:var(--yellow);font-size:12px;font-weight:600">⏱ ${escHtml(message || "Please wait 30 seconds between analyses.")}</div>
      </div>`;
    } else {
      card.innerHTML = `<div class="card" style="border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.04);padding:12px 16px">
        <div style="color:var(--red);font-size:12px;font-weight:600">⚠ ${escHtml(message || "Analysis failed")}</div>
      </div>`;
      setTimeout(() => card.remove(), 8000);
    }
    feed.prepend(card);
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async refreshDashboard() {
    const { stats } = await window.electronAPI.getCurrentSession();
    if (stats) {
      this.sessionStats = stats;
      document.getElementById("stat-analyses").textContent = stats.analyses;
      document.getElementById("stat-mistakes").textContent = stats.mistakes;
      document.getElementById("stat-positives").textContent = stats.positives;
      this.updateSkillBars(stats.skillAverages);
      this.updateSessionStrip(stats);
      this.updateSidebarSession();
    }

    const sessions = await window.electronAPI.getSessions();
    document.getElementById("stat-sessions").textContent = sessions.length;

    this.updateRecentActivity(sessions);
  },

  updateSkillBars(skillAverages) {
    const el = document.getElementById("skill-bars");
    if (!skillAverages || Object.keys(skillAverages).length === 0) {
      el.innerHTML = `<div style="color:var(--muted);font-size:12px">No data yet — analyze a replay to see your skill ratings.</div>`;
      return;
    }

    const skillOrder = ["positioning", "building", "mechanics", "rotation", "decision_making", "awareness"];
    const labels = { positioning: "Positioning", building: "Building", mechanics: "Mechanics", rotation: "Rotation", decision_making: "Decision", awareness: "Awareness" };
    const colors = {
      positioning: "#4d9de0",
      building: "#7b52d3",
      mechanics: "#22c55e",
      rotation: "#f77f00",
      decision_making: "#ef4444",
      awareness: "#eab308",
    };

    el.innerHTML = skillOrder
      .filter((k) => skillAverages[k] !== undefined)
      .map((k) => {
        const score = skillAverages[k];
        const pct = (score / 10) * 100;
        return `
        <div class="skill-bar-row">
          <div class="skill-name">${labels[k] || k}</div>
          <div class="skill-track">
            <div class="skill-fill" style="width:${pct}%;background:${colors[k] || "var(--blue)"}"></div>
          </div>
          <div class="skill-score" style="color:${colors[k] || "var(--blue)"}">${score}</div>
        </div>
      `;
      })
      .join("");

    // Update sidebar focus areas
    this.updateSidebarFocus();
  },

  updateSidebarFocus() {
    const areas = this.settings.focusAreas || [];
    const el = document.getElementById("sidebar-focus");
    if (areas.length === 0) {
      el.innerHTML = `<span style="color:var(--muted2)">All areas</span>`;
    } else {
      el.innerHTML = areas.map((a) => `<span style="display:inline-block;background:rgba(77,157,224,0.1);border-radius:4px;padding:2px 7px;margin:2px;font-size:10px;color:var(--blue)">${a.replace(/_/g," ")}</span>`).join("");
    }
  },

  updateRecentActivity(sessions) {
    const el = document.getElementById("recent-activity");
    if (!sessions || sessions.length === 0) {
      el.innerHTML = `<div style="color:var(--muted);font-size:12px">No recent sessions.</div>`;
      return;
    }

    el.innerHTML = sessions.slice(0, 4).map((s) => {
      const date = new Date(s.startedAt);
      const label = this.formatRelativeDate(date);
      const analyses = s.analyses?.length || 0;
      const mistakes = s.analyses?.reduce((sum, a) => sum + (a.mistakes?.length || 0), 0) || 0;
      const positives = s.analyses?.reduce((sum, a) => sum + (a.positives?.length || 0), 0) || 0;

      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:12px;font-weight:600">${label}</div>
            <div style="font-size:11px;color:var(--muted)">${analyses} frame${analyses !== 1 ? "s" : ""} analyzed</div>
          </div>
          <div style="display:flex;gap:6px">
            <span class="h-badge red">${mistakes} ⚠</span>
            <span class="h-badge green">${positives} ✓</span>
          </div>
        </div>
      `;
    }).join("");
  },

  updateWeaknessCard() {
    if (!this.sessionStats || !this.sessionStats.skillAverages) return;
    const avgs = this.sessionStats.skillAverages;
    const keys = Object.keys(avgs);
    if (keys.length === 0) return;

    const worst = keys.reduce((a, b) => avgs[a] < avgs[b] ? a : b);
    const best = keys.reduce((a, b) => avgs[a] > avgs[b] ? a : b);

    const card = document.getElementById("weakness-card");
    const content = document.getElementById("weakness-content");
    card.style.display = "block";

    content.innerHTML = `
      <div class="grid-2" style="gap:12px">
        <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:var(--red);margin-bottom:4px">Focus On</div>
          <div style="font-weight:700;font-size:13px;text-transform:capitalize;margin-bottom:2px">${worst.replace(/_/g," ")}</div>
          <div style="font-size:11px;color:var(--muted)">Your lowest rated area this session (${avgs[worst]}/10)</div>
        </div>
        <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;padding:12px 14px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.07em;color:var(--green);margin-bottom:4px">Your Strength</div>
          <div style="font-weight:700;font-size:13px;text-transform:capitalize;margin-bottom:2px">${best.replace(/_/g," ")}</div>
          <div style="font-size:11px;color:var(--muted)">Highest rated this session (${avgs[best]}/10)</div>
        </div>
      </div>
    `;
  },

  // ── Session timer ─────────────────────────────────────────────────────────
  tickSessionTimer() {
    if (!this.sessionStart) return;
    const elapsed = Math.floor((Date.now() - this.sessionStart) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    document.getElementById("strip-time").textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
  },

  updateSessionStrip(stats) {
    if (!stats) return;
    document.getElementById("strip-analyses").textContent = stats.analyses;
    document.getElementById("strip-mistakes").textContent = stats.mistakes;
    document.getElementById("strip-positives").textContent = stats.positives;
  },

  // ── History ───────────────────────────────────────────────────────────────
  async refreshHistory() {
    const sessions = await window.electronAPI.getSessions();
    const el = document.getElementById("history-list");

    if (!sessions || sessions.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-desc">Your replay coaching sessions will appear here after you analyze your first replay.</div>
        </div>
      `;
      return;
    }

    el.innerHTML = sessions.map((s) => {
      const date = new Date(s.startedAt);
      const label = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const analyses = s.analyses?.length || 0;
      const mistakes = s.analyses?.reduce((sum, a) => sum + (a.mistakes?.length || 0), 0) || 0;
      const positives = s.analyses?.reduce((sum, a) => sum + (a.positives?.length || 0), 0) || 0;

      const criticals = s.analyses?.reduce((sum, a) =>
        sum + (a.mistakes?.filter((m) => m.severity === "critical").length || 0), 0) || 0;

      return `
        <div class="history-item" onclick="app.expandSession('${s.id}')">
          <div class="history-item-header">
            <div>
              <div class="history-date">${label} · ${time}</div>
              <div class="history-meta">${analyses} frame${analyses !== 1 ? "s" : ""} analyzed</div>
            </div>
            <div style="font-size:12px;color:var(--muted)">▸</div>
          </div>
          <div class="history-badges">
            <span class="h-badge red">⚠ ${mistakes} mistake${mistakes !== 1 ? "s" : ""}</span>
            ${criticals > 0 ? `<span class="h-badge red">🔴 ${criticals} critical</span>` : ""}
            <span class="h-badge green">✓ ${positives} good play${positives !== 1 ? "s" : ""}</span>
            <span class="h-badge blue">🎬 ${analyses} frame${analyses !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div class="session-detail" id="detail-${s.id}" style="display:none;margin-bottom:10px"></div>
      `;
    }).join("");
  },

  expandSession(id) {
    const detailEl = document.getElementById(`detail-${id}`);
    if (!detailEl) return;

    if (detailEl.style.display === "block") {
      detailEl.style.display = "none";
      return;
    }

    // Find the session
    window.electronAPI.getSessions().then((sessions) => {
      const s = sessions.find((x) => x.id === id);
      if (!s) return;

      const analyses = s.analyses || [];
      if (analyses.length === 0) {
        detailEl.innerHTML = `<div style="padding:12px;color:var(--muted);font-size:12px">No frame data.</div>`;
      } else {
        detailEl.innerHTML = `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;margin-top:-4px;border-top-left-radius:0;border-top-right-radius:0">
            ${analyses.slice(0, 3).map((a) => {
              const time = new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return `
                <div style="border-bottom:1px solid var(--border);padding:10px 0;last-child:border-0">
                  <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${time}</div>
                  <div style="font-size:12px;color:var(--text);margin-bottom:6px">${escHtml(a.observation)}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${(a.mistakes || []).map((m) => `<span class="sev-badge ${m.severity}">${escHtml(m.title)}</span>`).join("")}
                  </div>
                </div>
              `;
            }).join("")}
            ${analyses.length > 3 ? `<div style="font-size:11px;color:var(--muted);padding-top:8px">+ ${analyses.length - 3} more frames…</div>` : ""}
          </div>
        `;
      }

      detailEl.style.display = "block";
    });
  },

  // ── Chat ──────────────────────────────────────────────────────────────────
  async sendChat() {
    const input = document.getElementById("chat-input");
    const msg = input.value.trim();
    if (!msg) return;

    input.value = "";
    this.addChatMsg("user", msg);
    this.chatHistory.push({ role: "user", content: msg });

    // Show typing indicator
    const typingId = "typing-" + Date.now();
    const typingEl = document.createElement("div");
    typingEl.id = typingId;
    typingEl.className = "chat-msg coach";
    typingEl.innerHTML = `
      <div class="chat-avatar">⚡</div>
      <div class="chat-bubble" style="padding:6px 12px">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;
    document.getElementById("chat-messages").appendChild(typingEl);
    this.scrollChatToBottom();

    const sendBtn = document.querySelector(".btn-send");
    sendBtn.disabled = true;

    try {
      const { reply } = await window.electronAPI.chat(msg, this.chatHistory.slice(-6));
      typingEl.remove();
      this.addChatMsg("coach", reply);
      this.chatHistory.push({ role: "assistant", content: reply });
    } catch {
      typingEl.remove();
      this.addChatMsg("coach", "Sorry, I couldn't connect to the coaching server. Check your internet.");
    }

    sendBtn.disabled = false;
    sendBtn.focus();
  },

  sendQuickQ(q) {
    document.getElementById("chat-input").value = q;
    this.sendChat();
    this.navigate("chat");
  },

  addChatMsg(role, text) {
    const el = document.createElement("div");
    el.className = `chat-msg ${role}`;
    el.innerHTML = `
      <div class="chat-avatar">${role === "coach" ? "⚡" : "🎮"}</div>
      <div class="chat-bubble">${escHtml(text)}</div>
    `;
    document.getElementById("chat-messages").appendChild(el);
    this.scrollChatToBottom();
  },

  scrollChatToBottom() {
    const el = document.getElementById("chat-messages");
    el.scrollTop = el.scrollHeight;
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  applySettingsToUI() {
    const s = this.settings;
    if (s.skillLevel) document.getElementById("setting-skill").value = s.skillLevel;
    if (s.coachingStyle) document.getElementById("setting-style").value = s.coachingStyle;
    if (s.captureIntervalSecs) {
      document.getElementById("setting-interval").value = s.captureIntervalSecs;
      document.getElementById("interval-display").textContent = s.captureIntervalSecs + "s";
    }
    if (s.focusAreas && s.focusAreas.length > 0) {
      document.querySelectorAll(".checkbox-pill").forEach((pill) => {
        const area = pill.dataset.area;
        const cb = pill.querySelector("input");
        if (s.focusAreas.includes(area)) {
          cb.checked = true;
          pill.classList.add("checked");
        }
      });
    }
    this.updateSidebarFocus();
  },

  async saveSettings() {
    const focusAreas = [];
    document.querySelectorAll(".checkbox-pill input:checked").forEach((cb) => {
      focusAreas.push(cb.value);
    });

    const settings = {
      skillLevel: document.getElementById("setting-skill").value,
      coachingStyle: document.getElementById("setting-style").value,
      captureIntervalSecs: parseInt(document.getElementById("setting-interval").value),
      focusAreas,
    };

    await window.electronAPI.saveSettings(settings);
    this.settings = { ...this.settings, ...settings };
    this.updateSidebarFocus();

    // Flash save button
    const btn = document.querySelector("[onclick='app.saveSettings()']");
    const orig = btn.textContent;
    btn.textContent = "✓ Saved!";
    btn.style.background = "linear-gradient(135deg,#15803d,var(--green))";
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = "";
    }, 1500);
  },

  // ── Capture actions ───────────────────────────────────────────────────────
  async manualCapture() {
    const btn = document.getElementById("manual-btn");
    btn.disabled = true;
    btn.textContent = "Capturing…";
    await window.electronAPI.manualCapture();
    btn.textContent = "📸 Capture Now";
    btn.disabled = false;
  },

  async forceAnalyze() {
    await window.electronAPI.forceAnalyze();
    this.navigate("live");
  },

  // ── Helpers ───────────────────────────────────────────────────────────────
  formatRelativeDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today · " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return date.toLocaleDateString([], { weekday: "long" });
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
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
