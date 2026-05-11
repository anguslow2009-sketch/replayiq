import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Status & session
  getStatus: () => ipcRenderer.invoke("get-status"),
  getCurrentSession: () => ipcRenderer.invoke("get-current-session"),
  getSessions: () => ipcRenderer.invoke("get-sessions"),

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings"),
  saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke("save-settings", settings),

  // Capture
  manualCapture: () => ipcRenderer.invoke("manual-capture"),
  forceAnalyze: () => ipcRenderer.invoke("force-analyze"),

  // Chat
  chat: (message: string, history: unknown[]) => ipcRenderer.invoke("chat", { message, history }),

  // Window controls
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),
  openWebsite: (path: string) => ipcRenderer.invoke("open-website", path),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),

  // Events
  onStatusChange: (cb: (payload: unknown) => void) => {
    ipcRenderer.on("status-change", (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners("status-change");
  },
  onCoachingResult: (cb: (result: unknown) => void) => {
    ipcRenderer.on("coaching-result", (_e, result) => cb(result));
    return () => ipcRenderer.removeAllListeners("coaching-result");
  },
  onSessionUpdate: (cb: (stats: unknown) => void) => {
    ipcRenderer.on("session-update", (_e, stats) => cb(stats));
    return () => ipcRenderer.removeAllListeners("session-update");
  },
  onSessionComplete: (cb: (stats: unknown) => void) => {
    ipcRenderer.on("session-complete", (_e, stats) => cb(stats));
    return () => ipcRenderer.removeAllListeners("session-complete");
  },
});
