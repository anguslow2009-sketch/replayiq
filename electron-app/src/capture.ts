import { desktopCapturer, NativeImage } from "electron";

/**
 * Finds the Fortnite window and captures a screenshot.
 * Returns null if Fortnite isn't running or can't be found.
 */
export async function captureFortniteWindow(
  quality: "low" | "high"
): Promise<NativeImage | null> {
  const size =
    quality === "high"
      ? { width: 1920, height: 1080 }
      : { width: 640, height: 360 };

  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: size,
  });

  // Fortnite window name patterns
  const fortnite = sources.find(
    (s) =>
      s.name === "Fortnite" ||
      s.name.includes("Fortnite ") ||
      s.name.includes("FortniteClient")
  );

  return fortnite?.thumbnail ?? null;
}

/**
 * Detects whether the captured frame shows the Fortnite replay viewer
 * by scanning the bottom strip for the characteristic dark scrubber bar
 * with orange/white timeline markers.
 *
 * No AI call needed — pure pixel heuristic, runs in <1ms.
 */
export function detectReplayMode(frame: NativeImage): boolean {
  const { width, height } = frame.getSize();
  if (width === 0 || height === 0) return false;

  // Raw RGBA bytes
  const bitmap = frame.toBitmap();

  // Scan the bottom 12% of the frame (where the scrubber lives)
  const stripStartRow = Math.floor(height * 0.88);
  let darkPixels = 0;
  let orangePixels = 0;
  let totalPixels = 0;

  for (let row = stripStartRow; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4;
      const r = bitmap[idx];
      const g = bitmap[idx + 1];
      const b = bitmap[idx + 2];

      totalPixels++;

      // Very dark pixel — characteristic of replay scrubber background
      // (#0d0d0d to #2a2a2a range)
      if (r < 45 && g < 45 && b < 45) {
        darkPixels++;
      }

      // Orange pixel — the replay timeline playhead / progress bar
      // Fortnite uses roughly #ff8c00 to #ffb347
      if (r > 180 && g > 90 && g < 180 && b < 60) {
        orangePixels++;
      }
    }
  }

  if (totalPixels === 0) return false;

  const darkRatio = darkPixels / totalPixels;

  // Replay scrubber: >50% dark pixels in bottom strip + at least some orange
  return darkRatio > 0.5 && orangePixels > 20;
}

/**
 * Returns true if a Fortnite window source exists at all (name check only,
 * no thumbnail needed — fast).
 */
export async function isFortniteRunning(): Promise<boolean> {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1, height: 1 },
  });
  return sources.some(
    (s) =>
      s.name === "Fortnite" ||
      s.name.includes("Fortnite ") ||
      s.name.includes("FortniteClient")
  );
}
