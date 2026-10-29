import type { DemoShot } from "./types";

export function clampPlayhead(value: number, duration: number) {
  if (!Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, value));
}

export function playbackFrame(shots: DemoShot[], value: number, duration: number) {
  const time = clampPlayhead(value, duration);
  // At a cut the next shot owns the boundary; the final frame remains visible.
  const found = shots.findIndex(shot => time < shot.end);
  const index = Math.max(0, found < 0 ? shots.length - 1 : found);
  const shot = shots[index];
  const progress = shot && shot.end > shot.start
    ? Math.max(0, Math.min(1, (time - shot.start) / (shot.end - shot.start))) : 0;
  return { time, index, shot, progress };
}

export function cameraPosition(index: number, progress: number) {
  const t = clampPlayhead(progress, 1);
  // Keep all offsets inside the overscan, so a pan never reveals empty edges.
  switch (index % 4) {
    case 1: return { scale: 1.12, x: 2.5 - 5 * t, y: -0.5 + t };
    case 2: return { scale: 1.16 - 0.12 * t, x: 1.2 - 1.9 * t, y: -0.5 + t };
    case 3: return { scale: 1.12, x: -2.5 + 5 * t, y: 0.5 - t };
    default: return { scale: Math.min(1.16, 1.04 + 0.12 * t), x: -1.2 + 3 * t, y: 0.5 - t };
  }
}
