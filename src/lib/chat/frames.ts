"use client";
import JSZip from "jszip";

/**
 * Extract distinct frames from a screen recording, in the browser.
 * Samples every `step` seconds, skips frames that look the same as the last kept one
 * (16x16 grayscale fingerprint), caps at `max` frames. Returns a zip of JPEGs.
 */
export async function extractFrames(
  file: File,
  onProgress: (pct: number) => void,
  { step = 0.6, max = 240, width = 720 } = {},
): Promise<{ zip: Blob; count: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("video_unreadable"));
  });
  const scale = Math.min(1, width / (video.videoWidth || width));
  const w = Math.round((video.videoWidth || width) * scale);
  const h = Math.round((video.videoHeight || width * 2) * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const tiny = document.createElement("canvas");
  tiny.width = 16; tiny.height = 16;
  const tctx = tiny.getContext("2d", { willReadFrequently: true })!;

  const seek = (t: number) => new Promise<void>((res) => { video.onseeked = () => res(); video.currentTime = t; });
  const zip = new JSZip();
  let last: Uint8ClampedArray | null = null;
  let kept = 0;
  const duration = video.duration || 0;
  for (let t = 0; t < duration && kept < max; t += step) {
    await seek(t);
    ctx.drawImage(video, 0, 0, w, h);
    // fingerprint the middle 70% (ignores status bar and keyboard)
    tctx.drawImage(canvas, 0, h * 0.12, w, h * 0.7, 0, 0, 16, 16);
    const px = tctx.getImageData(0, 0, 16, 16).data;
    let diff = Infinity;
    if (last) {
      diff = 0;
      for (let i = 0; i < px.length; i += 4) diff += Math.abs(px[i] + px[i + 1] + px[i + 2] - (last[i] + last[i + 1] + last[i + 2]));
      diff /= 256 * 3;
    }
    if (diff > 6) {
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.72));
      zip.file(`${String(kept).padStart(4, "0")}.jpg`, blob);
      kept++;
      last = px;
    }
    onProgress(Math.min(99, Math.round((t / duration) * 100)));
  }
  URL.revokeObjectURL(url);
  return { zip: await zip.generateAsync({ type: "blob" }), count: kept };
}
