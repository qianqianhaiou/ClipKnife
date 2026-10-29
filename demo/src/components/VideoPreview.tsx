import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FolderPlus, Info, Pause, Play, RotateCcw, Search, VolumeX } from "lucide-react";
import { cameraPosition, clampPlayhead, playbackFrame } from "../playback";
import { timeLabel } from "../model";
import type { DemoAsset, MediaRef } from "../types";
import { Photo, photoUrl } from "./ui";

export function VideoPreview({ asset, initialShotId, suspended, onAdd, onSimilar }: {
  asset: DemoAsset; initialShotId?: string; suspended: boolean;
  onAdd: (ref: MediaRef) => void; onSimilar: (id: string) => void;
}) {
  const shots = asset.shots.length ? asset.shots : [{ id: `${asset.id}-still`, photo: asset.photo,
    start: 0, end: asset.duration, description: asset.description }];
  const initialTime = shots.find(shot => shot.id === initialShotId)?.start ?? 0;
  const [time, setTime] = useState(initialTime);
  const playhead = useRef(initialTime);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [playing, setPlaying] = useState(() => !matchMedia("(prefers-reduced-motion: reduce)").matches && !document.hidden);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const { shot, index, progress } = playbackFrame(shots, time, asset.duration);
  const ready = Boolean(shot && loadedId === shot.id && failedId !== shot.id);
  const ended = time >= asset.duration;
  const running = playing && ready && !suspended && !ended;
  const camera = cameraPosition(index, progress);
  const nextPhoto = shots[index + 1]?.photo;

  useEffect(() => {
    const url = nextPhoto ? photoUrl(nextPhoto, true) : undefined;
    if (!url) return;
    const image = new Image(); image.src = url;
    return () => image.removeAttribute("src");
  }, [nextPhoto]);

  function seek(value: number) {
    const next = clampPlayhead(value, asset.duration);
    playhead.current = next; setTime(next);
    if (next === asset.duration) setPlaying(false);
  }
  function toggle() {
    if (!ready || suspended || asset.duration <= 0) return;
    if (ended) { seek(0); setPlaying(true); }
    else setPlaying(value => !value);
  }
  function changeShot(next: number) { const target = shots[next]; if (target) seek(target.start); }

  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    let request = 0;
    function tick(now: number) {
      const next = clampPlayhead(playhead.current + (now - previous) / 1000, asset.duration);
      previous = now; playhead.current = next; setTime(next);
      if (next >= asset.duration) setPlaying(false);
      else request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [running, asset.duration]);
  useEffect(() => { if (suspended) setPlaying(false); }, [suspended]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) setPlaying(false); };
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { setReduced(preference.matches); if (preference.matches) setPlaying(false); };
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", change);
    return () => { document.removeEventListener("visibilitychange", visibility); preference.removeEventListener("change", change); };
  }, []);

  if (!shot) return null;
  const label = ended ? "重播演示" : playing ? "暂停演示" : "播放演示";
  return <>
    <div className="preview-workspace has-shots video-preview" data-playing={running} data-reduced-motion={reduced}>
      <div className="preview-main">
        <div className={`preview-stage video-stage${asset.height > asset.width ? " portrait-video" : ""}`}>
          <div className="video-canvas">
            <div key={shot.id} className="video-frame" style={{ transform: reduced || !ready ? "none"
              : `translate3d(${camera.x}%,${camera.y}%,0) scale(${camera.scale})` }}>
              <Photo name={shot.photo} alt={shot.description} full eager retry
                onLoad={() => { setLoadedId(shot.id); setFailedId(null); }}
                onError={() => { setFailedId(shot.id); setPlaying(false); }} />
            </div>
            {ready && <button type="button" className={`video-stage-toggle${running ? " is-playing" : ""}`} aria-label={label} onClick={toggle}>
              <span>{ended ? <RotateCcw /> : playing ? <Pause /> : <Play />}</span>
            </button>}
            {!ready && failedId !== shot.id && <span className="video-loading" role="status">正在准备画面…</span>}
          </div>
          <span className="video-mode"><span />动态演示</span>
        </div>
        <div className="video-transport">
          <input className="video-progress" type="range" min={0} max={asset.duration} step={0.1} value={time}
            aria-label="播放进度" aria-valuetext={`${timeLabel(time)} / ${timeLabel(asset.duration)}`}
            style={{ background: `linear-gradient(to right, #f95106 ${asset.duration ? time / asset.duration * 100 : 0}%, #33373e 0)` }}
            onChange={event => seek(Number(event.target.value))} />
          <div className="preview-controls video-controls">
            <button type="button" className="icon-button playback-toggle" aria-label={label} disabled={!ready || asset.duration <= 0} onClick={toggle}>
              {ended ? <RotateCcw /> : playing ? <Pause /> : <Play />}
            </button>
            <span className="video-clock">{timeLabel(time)} <span>/ {timeLabel(asset.duration)}</span></span>
            <span className="video-silent"><VolumeX />无声演示</span>
            <div className="video-shot-controls">
              <button type="button" className="icon-button" disabled={index === 0} aria-label="上一分镜" onClick={() => changeShot(index - 1)}><ChevronLeft /></button>
              <span>分镜 {index + 1} / {shots.length}</span>
              <button type="button" className="icon-button" disabled={index === shots.length - 1} aria-label="下一分镜" onClick={() => changeShot(index + 1)}><ChevronRight /></button>
            </div>
          </div>
        </div>
        <div className="preview-description"><span>画面描述</span><p>{shot.description}</p></div>
      </div>
      <aside className="preview-shots"><h3>视频分镜<span>{shots.length} 个</span></h3>{shots.map((item, i) => <button type="button" key={item.id}
        aria-pressed={shot.id === item.id} className={shot.id === item.id ? "selected" : ""} onClick={() => changeShot(i)}>
        <div className="shot-image"><Photo name={item.photo} alt={item.description} /><span>{String(i + 1).padStart(2, "0")}</span></div>
        <strong>{timeLabel(item.start)} – {timeLabel(item.end)}</strong><p>{item.description}</p>
      </button>)}</aside>
    </div>
    <footer className="preview-footer"><span><Info />静帧动态演示 · 非原视频播放</span><div>
      <button type="button" className="button" onClick={() => onSimilar(asset.id)}><Search />查找相似</button>
      <button type="button" className="button primary" onClick={() => { setPlaying(false); onAdd({ assetId: asset.id, ...(asset.shots.length ? { shotId: shot.id } : {}) }); }}><FolderPlus />添加当前分镜到分组</button>
    </div></footer>
  </>;
}
