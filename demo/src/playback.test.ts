import { describe, expect, it } from "vitest";
import { assets } from "./data";
import { cameraPosition, clampPlayhead, playbackFrame } from "./playback";

const video = assets.find(asset => asset.id === "coast-film")!;

describe("demo playback timeline", () => {
  it("seeks across cuts and retains the final frame at the end", () => {
    const first = video.shots[0]!;
    const second = video.shots[1]!;
    expect(playbackFrame(video.shots, 0, video.duration).shot?.id).toBe(first.id);
    expect(playbackFrame(video.shots, second.start - 0.01, video.duration).shot?.id).toBe(first.id);
    expect(playbackFrame(video.shots, second.start, video.duration)).toMatchObject({ shot: second, progress: 0 });
    expect(playbackFrame(video.shots, video.duration, video.duration)).toMatchObject({ index: video.shots.length - 1, progress: 1 });
    expect(playbackFrame(video.shots, video.duration * 2, video.duration).time).toBe(video.duration);
  });
  it("clamps invalid and out-of-range seeks", () => {
    expect(clampPlayhead(-5, 48)).toBe(0);
    expect(clampPlayhead(55, 48)).toBe(48);
    expect(clampPlayhead(NaN, 48)).toBe(0);
    expect(clampPlayhead(Infinity, 48)).toBe(0);
    expect(clampPlayhead(5, 0)).toBe(0);
    expect(clampPlayhead(5, Infinity)).toBe(0);
  });
  it("handles an empty or zero-length timeline without invalid values", () => {
    expect(playbackFrame([], 1, 0)).toEqual({ time: 0, index: 0, shot: undefined, progress: 0 });
    expect(playbackFrame([{ id: "still", start: 0, end: 0, photo: "coast", description: "still" }], 5, 0).progress).toBe(0);
  });
  it("keeps every sample shot addressable at its start and midpoint", () => {
    for (const asset of assets.filter(item => item.kind === "video")) {
      for (const shot of asset.shots) {
        expect(playbackFrame(asset.shots, shot.start, asset.duration).shot?.id).toBe(shot.id);
        expect(playbackFrame(asset.shots, (shot.start + shot.end) / 2, asset.duration)).toMatchObject({ shot, progress: 0.5 });
      }
    }
  });
});

describe("still-frame camera motion", () => {
  it("alternates push, pull and opposing pans", () => {
    expect(cameraPosition(0, 1).scale).toBeGreaterThan(cameraPosition(0, 0).scale);
    expect(cameraPosition(2, 1).scale).toBeLessThan(cameraPosition(2, 0).scale);
    expect(cameraPosition(1, 1).x).toBeLessThan(cameraPosition(1, 0).x);
    expect(cameraPosition(3, 1).x).toBeGreaterThan(cameraPosition(3, 0).x);
  });
  it("never exposes an empty edge during zoom or pan", () => {
    for (let shot = 0; shot < 8; shot++) for (let frame = 0; frame <= 120; frame++) {
      const { scale, x, y } = cameraPosition(shot, frame / 120);
      const overscan = (scale - 1) * 50;
      expect(Math.abs(x)).toBeLessThanOrEqual(overscan);
      expect(Math.abs(y)).toBeLessThanOrEqual(overscan);
      expect(scale).toBeLessThanOrEqual(1.16);
    }
  });
});
