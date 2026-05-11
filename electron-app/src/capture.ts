import { desktopCapturer, NativeImage } from "electron";

export async function captureFortniteWindow(
  quality: "low" | "high"
): Promise<NativeImage | null> {
  const size =
    quality === "high"
      ? { width: 1920, height: 1080 }
      : { width: 960, height: 540 };

  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: size,
  });

  // Try to find the Fortnite window first
  const fortnite = sources.find(
    (s) =>
      s.name === "Fortnite" ||
      s.name.toLowerCase().includes("fortnite") ||
      s.name.includes("FortniteClient-Win64")
  );

  if (fortnite?.thumbnail) return fortnite.thumbnail;

  // Fallback: capture the entire screen (Fortnite may be fullscreen)
  const screen = sources.find(
    (s) => s.name === "Entire Screen" || s.name === "Screen 1" || s.id.startsWith("screen:")
  );
  return screen?.thumbnail ?? null;
}

// Lightweight check — just looks for the dark scrubber bar region.
// Thresholds are intentionally lenient; Claude confirms replay status in vision analysis.
export function detectReplayMode(frame: NativeImage): boolean {
  const { width, height } = frame.getSize();
  if (width === 0 || height === 0) return false;

  const bitmap = frame.toBitmap();

  // Scan the bottom 18% of the frame (replay scrubber can be anywhere in this zone)
  const stripStartRow = Math.floor(height * 0.82);
  let darkPixels = 0;
  let totalPixels = 0;

  for (let row = stripStartRow; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4;
      const r = bitmap[idx];
      const g = bitmap[idx + 1];
      const b = bitmap[idx + 2];
      totalPixels++;
      if (r < 60 && g < 60 && b < 60) darkPixels++;
    }
  }

  if (totalPixels === 0) return false;

  // Very lenient — if more than 20% of the bottom strip is dark,
  // we assume it could be the replay UI. Claude confirms in vision call.
  return darkPixels / totalPixels > 0.2;
}

export async function isFortniteRunning(): Promise<boolean> {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1, height: 1 },
  });
  return sources.some(
    (s) =>
      s.name === "Fortnite" ||
      s.name.toLowerCase().includes("fortnite") ||
      s.name.includes("FortniteClient")
  );
}
