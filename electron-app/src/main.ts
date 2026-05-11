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

const store = new Store<{ apiBase: string; captureIntervalSecs: number }>();

const API_BASE =
  (store.get("apiBase") as string | undefined) ||
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

// ── Window ────────────────────────────────────────────────────────────────────
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 700,
    minWidth: 360,
    minHeight: 400,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: "#05050f",
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
    {
      label: "Open website",
      click: () => shell.openExternal(API_BASE),
    },
    { type: "separator" },
    { label: "Quit ReplayIQ", click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
  tray.setToolTip("ReplayIQ");
  tray.on("double-click", () => { overlayWindow?.show(); overlayWindow?.focus(); });
}

// ── Status broadcast ──────────────────────────────────────────────────────────
function setStatus(status: AppStatus, extra?: Record<string, unknown>) {
  currentStatus = status;
  overlayWindow?.webContents.send("status-change", { status, ...extra });
}

// ── Fortnite detection loop (every 4 seconds) ─────────────────────────────────
async function startDetectionLoop() {
  if (detectionTimer) clearInterval(detectionTimer);

  detectionTimer = setInterval(async () => {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: 32, height: 32 },
    });

    const fortniteRunning = sources.some(
      (s) =>
        s.name.toLowerCase().includes("fortnite") ||
        s.name.includes("FortniteClient")
    );

    if (!fortniteRunning) {
      setStatus("fortnite_not_running");
      stopCaptureLoop();
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

    const inReplay = detectReplayMode(frame);

    if (inReplay && currentStatus !== "replay_detected" && currentStatus !== "analyzing") {
      setStatus("replay_detected");
      startCaptureLoop();
    } else if (!inReplay && (currentStatus === "replay_detected" || currentStatus === "analyzing")) {
      setStatus("fortnite_running");
      stopCaptureLoop();
    }
  }, 4000);
}

// ── Capture + analysis loop (every 30 seconds while in replay mode) ───────────
function startCaptureLoop() {
  if (captureTimer) return;

  const INTERVAL_SECS = (store.get("captureIntervalSecs") as number | undefined) ?? 30;

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

  if (!detectReplayMode(frame)) {
    setStatus("fortnite_running");
    stopCaptureLoop();
    return;
  }

  setStatus("analyzing");

  try {
    const result = await analyzeFrame({
      imageBase64: frame.toJPEG(85).toString("base64"),
      apiBase: API_BASE,
    });

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
    setStatus("replay_detected");
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle("get-status", () => ({ status: currentStatus }));

ipcMain.handle("open-website", (_event, path: string) => {
  shell.openExternal(`${API_BASE}${path || ""}`);
});

ipcMain.handle("manual-capture", async () => {
  if (currentStatus !== "replay_detected" && currentStatus !== "analyzing") {
    return { error: "Not in replay mode" };
  }
  await runCapture();
});

ipcMain.handle("window-minimize", () => overlayWindow?.minimize());
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
    // Keep running in tray on Windows
  });

  app.on("activate", () => {
    if (!overlayWindow) createOverlayWindow();
  });
}
