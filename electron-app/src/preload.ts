import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Auth
  setToken: (token: string) => ipcRenderer.invoke("set-token", token),
  hasToken: () => ipcRenderer.invoke("get-token"),
  signOut: () => ipcRenderer.invoke("sign-out"),
  openWebsite: (path: string) => ipcRenderer.invoke("open-website", path),

  // Status
  getStatus: () => ipcRenderer.invoke("get-status"),

  // Capture
  manualCapture: () => ipcRenderer.invoke("manual-capture"),

  // Window controls
  minimize: () => ipcRenderer.invoke("window-minimize"),
  close: () => ipcRenderer.invoke("window-close"),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),

  // Events (main → renderer)
  onStatusChange: (cb: (payload: StatusPayload) => void) => {
    ipcRenderer.on("status-change", (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners("status-change");
  },
  onCoachingResult: (cb: (result: CoachingEvent) => void) => {
    ipcRenderer.on("coaching-result", (_e, result) => cb(result));
    return () => ipcRenderer.removeAllListeners("coaching-result");
  },
});

// ── Shared types (duplicated in renderer/app.js as JSDoc) ─────────────────────
export interface StatusPayload {
  status:
    | "no_token"
    | "fortnite_not_running"
    | "fortnite_running"
    | "replay_detected"
    | "analyzing"
    | "error";
  authenticated?: boolean;
}

export interface CoachingEvent {
  type: "coaching" | "error" | "rate_limited";
  data?: {
    observation: string;
    mistakes: { severity: string; title: string; description: string; suggestion: string }[];
    positives: string[];
    timestamp: string;
  };
  message?: string;
  error?: string;
}
