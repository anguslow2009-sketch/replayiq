import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  shell,
  desktopCapturer,
} from "electron";
import * as path from "path";
import Store from "electron-store";
import { captureFortniteWindow, detectReplayMode } from "./capture";
import { analyzeFrame } from "./api";
import { chatWithCoach } from "./chat";

interface Settings {
  apiBase: string;
  captureIntervalSecs: number;
  skillLevel: string;
  focusAreas: string[];
  coachingStyle: string;
}

interface AnalysisMistake {
  severity: string;
  category: string;
  title: string;
  description: string;
  why_bad: string;
  what_pros_do: string;
  suggestion: string;
}

interface AnalysisPositive {
  category: string;
  title: string;
  description: string;
}

interface AnalysisEntry {
  timestamp: string;
  observation: string;
  mistakes: AnalysisMistake[];
  positives: AnalysisPositive[];
  skill_scores: Record<string, number | null>;
  game_state: Record<string, unknown>;
  is_replay: boolean;
}

interface Session {
  id: string;
  startedAt: string;
  endedAt?: string;
  analyses: AnalysisEntry[];
}

interface StoreSchema {
  settings: Settings;
  sessions: Session[];
}

const store = new Store<StoreSchema>({
  defaults: {
    settings: {
      apiBase: "",
      captureIntervalSecs: 30,
      skillLevel: "intermediate",
      focusAreas: [],
      coachingStyle: "balanced",
    },
    sessions: [],
  },
});

const API_BASE =
  (store.get("settings.apiBase") as string | undefined) ||
  process.env.REPLAYIQ_API_BASE ||
  "https://fortnite-replay-analyzer.vercel.app";

let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let captureTimer: ReturnType<typeof setInterval> | null = null;
let detectionTimer: ReturnType<typeof setInterval> | null = null;

type AppStatus =
  | "fortnite_not_running"
  | "fortnite_running"
  | "replay_detected"
  | "analyzing"
  | "error";

let currentStatus: AppStatus = "fortnite_not_running";
let currentSession: Session | null = null;
let replayAnalysisCount = 0;
const MAX_ANALYSES_PER_REPLAY = 10; // 10 × 30s = 5 minutes

function newSession(): Session {
  return {
    id: Date.now().toString(),
    startedAt: new Date().toISOString(),
    analyses: [],
  };
}

function saveSession(session: Session) {
  const sessions = (store.get("sessions") as Session[]) || [];
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  // Keep only last 50 sessions
  store.set("sessions", sessions.slice(0, 50));
}

// ── Window ────────────────────────────────────────────────────────────────────
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: "#040813",
    icon: path.join(__dirname, "..", "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(
    path.join(__dirname, "..", "src", "renderer", "index.html")
  );

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "..", "assets", "tray.png")
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const menu = Menu.buildFromTemplate([
    {
      label: "Show ReplayIQ",
      click: () => { overlayWindow?.show(); overlayWindow?.focus(); },
    },
    { type: "separator" },
    { label: "Quit ReplayIQ", click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip("ReplayIQ");
  tray.on("double-click", () => { overlayWindow?.show(); overlayWindow?.focus(); });
}

// ── Status ────────────────────────────────────────────────────────────────────
function setStatus(status: AppStatus, extra?: Record<string, unknown>) {
  currentStatus = status;
  overlayWindow?.webContents.send("status-change", { status, ...extra });
}

// ── Detection loop ────────────────────────────────────────────────────────────
async function startDetectionLoop() {
  if (detectionTimer) clearInterval(detectionTimer);

  detectionTimer = setInterval(async () => {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 32, height: 32 },
    });

    const fortniteRunning = sources.some(
      (s) =>
        s.name === "Fortnite" ||
        s.name.toLowerCase().includes("fortnite") ||
        s.name.includes("FortniteClient")
    );

    if (!fortniteRunning) {
      if (currentStatus !== "fortnite_not_running") {
        endSession();
        setStatus("fortnite_not_running");
        stopCaptureLoop();
      }
      return;
    }

    if (currentStatus === "fortnite_not_running") {
      setStatus("fortnite_running");
    }

    const frame = await captureFortniteWindow("low");
    if (!frame) {
      setStatus("fortnite_running");
      stopCaptureLoop();
      return;
    }

    const looksLikeReplay = detectReplayMode(frame);

    if (looksLikeReplay && currentStatus !== "replay_detected" && currentStatus !== "analyzing") {
      if (!currentSession) {
        currentSession = newSession();
        replayAnalysisCount = 0;
      }
      setStatus("replay_detected");
      startCaptureLoop();
    } else if (!looksLikeReplay && (currentStatus === "replay_detected" || currentStatus === "analyzing")) {
      setStatus("fortnite_running");
      stopCaptureLoop();
    }
  }, 4000);
}

function endSession() {
  if (currentSession && currentSession.analyses.length > 0) {
    currentSession.endedAt = new Date().toISOString();
    saveSession(currentSession);
  }
  currentSession = null;
}

// ── Capture loop ──────────────────────────────────────────────────────────────
function startCaptureLoop() {
  if (captureTimer) return;

  const settings = store.get("settings") as Settings;
  const INTERVAL_SECS = settings.captureIntervalSecs ?? 30;

  captureTimer = setInterval(async () => {
    await runCapture();
  }, INTERVAL_SECS * 1000);

  runCapture();
}

function stopCaptureLoop() {
  if (captureTimer) {
    clearInterval(captureTimer);
    captureTimer = null;
  }
}

async function runCapture() {
  const frame = await captureFortniteWindow("high");
  if (!frame) return;

  setStatus("analyzing");

  const settings = store.get("settings") as Settings;

  try {
    const result = await analyzeFrame({
      imageBase64: frame.toJPEG(85).toString("base64"),
      apiBase: API_BASE,
      skillLevel: settings.skillLevel,
      focusAreas: settings.focusAreas,
    });

    if (!result.is_replay) {
      // Claude says this isn't a replay frame — go back to waiting
      setStatus("fortnite_running");
      stopCaptureLoop();
      return;
    }

    // Store in current session
    if (currentSession) {
      const entry: AnalysisEntry = {
        timestamp: (result.timestamp as string) || new Date().toISOString(),
        observation: (result.observation as string) || "",
        mistakes: (result.mistakes as AnalysisMistake[]) || [],
        positives: (result.positives as AnalysisPositive[]) || [],
        skill_scores: (result.skill_scores as Record<string, number | null>) || {},
        game_state: (result.game_state as Record<string, unknown>) || {},
        is_replay: true,
      };
      currentSession.analyses.push(entry);
      replayAnalysisCount++;
      if (currentSession.analyses.length % 3 === 0) saveSession(currentSession);
      overlayWindow?.webContents.send("session-update", buildSessionStats());

      // 5-minute threshold reached — stop and show summary
      if (replayAnalysisCount >= MAX_ANALYSES_PER_REPLAY) {
        stopCaptureLoop();
        endSession();
        setStatus("fortnite_running");
        overlayWindow?.webContents.send("session-complete", buildSessionStats());
        replayAnalysisCount = 0;
        return;
      }
    }

    if (result.rateLimited) {
      overlayWindow?.webContents.send("coaching-result", {
        type: "rate_limited",
        message: result.error,
      });
    } else {
      overlayWindow?.webContents.send("coaching-result", {
        type: "coaching",
        data: result,
      });
    }
  } catch (err) {
    overlayWindow?.webContents.send("coaching-result", {
      type: "error",
      message: err instanceof Error ? err.message : "Analysis failed",
    });
  } finally {
    if (currentStatus === "analyzing") setStatus("replay_detected");
  }
}

function buildSessionStats() {
  if (!currentSession) return null;
  const analyses = currentSession.analyses;
  if (analyses.length === 0) return { analyses: 0, mistakes: 0, positives: 0, skillAverages: {} };

  let totalMistakes = 0;
  let totalPositives = 0;
  const skillSums: Record<string, number> = {};
  const skillCounts: Record<string, number> = {};

  for (const a of analyses) {
    totalMistakes += a.mistakes.length;
    totalPositives += a.positives.length;
    for (const [k, v] of Object.entries(a.skill_scores || {})) {
      if (v !== null && v !== undefined) {
        skillSums[k] = (skillSums[k] || 0) + (v as number);
        skillCounts[k] = (skillCounts[k] || 0) + 1;
      }
    }
  }

  const skillAverages: Record<string, number> = {};
  for (const k of Object.keys(skillSums)) {
    skillAverages[k] = Math.round((skillSums[k] / skillCounts[k]) * 10) / 10;
  }

  return {
    analyses: analyses.length,
    mistakes: totalMistakes,
    positives: totalPositives,
    skillAverages,
    startedAt: currentSession.startedAt,
  };
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("get-status", () => ({ status: currentStatus }));

ipcMain.handle("get-settings", () => store.get("settings"));

ipcMain.handle("save-settings", (_event, settings: Partial<Settings>) => {
  const current = store.get("settings") as Settings;
  store.set("settings", { ...current, ...settings });
  return true;
});

ipcMain.handle("get-sessions", () => {
  const sessions = (store.get("sessions") as Session[]) || [];
  return sessions.slice(0, 20);
});

ipcMain.handle("get-current-session", () => ({
  session: currentSession,
  stats: buildSessionStats(),
}));

ipcMain.handle("force-analyze", async () => {
  if (!currentSession) currentSession = newSession();
  replayAnalysisCount = 0;
  setStatus("replay_detected");
  startCaptureLoop();
  return true;
});

ipcMain.handle("chat", async (_event, { message, history }: { message: string; history: {role: string; content: string}[] }) => {
  const analyses = currentSession?.analyses || [];
  const recentAnalyses = analyses.slice(-5);

  const sessionSummary = recentAnalyses.length === 0
    ? "No replay analysis captured yet this session."
    : recentAnalyses.map((a, i) => {
        const mistakes = a.mistakes.map((m) => `- [${m.severity}] ${m.title}: ${m.description}`).join("\n");
        const positives = a.positives.map((p) => `+ ${p.title}`).join("\n");
        return `Frame ${i + 1} (${new Date(a.timestamp).toLocaleTimeString()}):\n${a.observation}\nMistakes:\n${mistakes || "None"}\nStrengths:\n${positives || "None"}`;
      }).join("\n\n---\n\n");

  try {
    const reply = await chatWithCoach({
      message,
      sessionSummary,
      history: history as { role: "user" | "assistant"; content: string }[],
      apiBase: API_BASE,
    });
    return { reply };
  } catch (err) {
    return { reply: "Sorry, I couldn't connect to the coaching server. Check your internet connection." };
  }
});

ipcMain.handle("open-website", (_event, p: string) => {
  shell.openExternal(`${API_BASE}${p || ""}`);
});

ipcMain.handle("manual-capture", async () => {
  await runCapture();
});

ipcMain.handle("window-minimize", () => overlayWindow?.minimize());
ipcMain.handle("window-maximize", () => {
  if (overlayWindow?.isMaximized()) overlayWindow.unmaximize();
  else overlayWindow?.maximize();
});
ipcMain.handle("window-close", () => overlayWindow?.hide());
ipcMain.handle("open-devtools", () =>
  overlayWindow?.webContents.openDevTools({ mode: "detach" })
);

// ── App lifecycle ─────────────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createOverlayWindow();
    createTray();
    startDetectionLoop();
  });

  app.on("second-instance", () => {
    overlayWindow?.show();
    overlayWindow?.focus();
  });

  app.on("window-all-closed", () => {
    // Keep running in tray
  });

  app.on("activate", () => {
    if (!overlayWindow) createOverlayWindow();
  });

  app.on("before-quit", () => {
    endSession();
  });
}
