import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openWebsite: (path: string) => ipcRenderer.invoke("open-website", path),
  getStatus: () => ipcRenderer.invoke("get-status"),
  manualCapture: () => ipcRenderer.invoke("manual-capture"),
  minimize: () => ipcRenderer.invoke("window-minimize"),
  close: () => ipcRenderer.invoke("window-close"),
  openDevTools: () => ipcRenderer.invoke("open-devtools"),

  onStatusChange: (cb: (payload: StatusPayload) => void) => {
    ipcRenderer.on("status-change", (_e, payload) => cb(payload));
    return () => ipcRenderer.removeAllListeners("status-change");
  },
  onCoachingResult: (cb: (result: CoachingEvent) => void) => {
    ipcRenderer.on("coaching-result", (_e, result) => cb(result));
    return () => ipcRenderer.removeAllListeners("coaching-result");
  },
});

export interface StatusPayload {
  status:
    | "fortnite_not_running"
    | "fortnite_running"
    | "replay_detected"
    | "analyzing"
    | "error";
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
