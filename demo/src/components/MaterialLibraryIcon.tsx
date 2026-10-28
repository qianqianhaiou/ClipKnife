import { useId } from "react";

export type MaterialLibraryIconKind = "overview" | "all" | "video" | "image" | "audio" | "people" | "organization" | "folder";

/** Small solid icons matching the approved I mockup; the highlight stays inside the shape. */
export function MaterialLibraryIcon({ kind }: { kind: MaterialLibraryIconKind }) {
  const id = useId();
  const colors: Record<MaterialLibraryIconKind, [string, string]> = {
    overview: ["#ff873d", "#e84b0d"], all: ["#ff924b", "#ef5d18"], video: ["#c7b3f6", "#8971d4"],
    image: ["#94bdf2", "#5b8dce"], audio: ["#c1a1f5", "#9061d1"],
    people: ["#c6b4ee", "#9276c9"], organization: ["#99e6d0", "#53af9e"],
    folder: ["#ffcf65", "#e9a932"],
  };
  const [light, dark] = colors[kind];
  return <svg className="material-solid-icon" aria-hidden="true" viewBox="0 0 28 28" fill="none">
    <defs><linearGradient id={id} x1="5" y1="3" x2="22" y2="26" gradientUnits="userSpaceOnUse"><stop stopColor={light} /><stop offset="1" stopColor={dark} /></linearGradient></defs>
    <g fill={`url(#${id})`} stroke={light} strokeWidth=".5">
      {kind === "overview" ? <><rect x="3" y="3" width="22" height="9" rx="2" /><rect x="3" y="16" width="9" height="9" rx="2" /><rect x="16" y="16" width="9" height="9" rx="2" /><path d="M10 7h8M6 20h3m10 0h3" stroke="#451b0a" strokeWidth="1.5" /></> : null}
      {kind === "video" ? <><rect x="3" y="5" width="17" height="19" rx="3" /><path d="m21 10 4-2v14l-4-2z" /><path d="m9 10 6 4-6 4z" fill="#f6f0ff" stroke="none" /></> : null}
      {kind === "image" || kind === "all" ? <><rect x="3" y="4" width="22" height="21" rx="3" /><circle cx="9" cy="10" r="2" fill="#17181b" stroke="none" /><path d="m5 22 7-8 4 4 4-6 3 10z" fill="#17181b" stroke="none" opacity=".9" /></> : null}
      {kind === "audio" ? <><path d="M11 6v14c0 3-7 5-8 1-1-3 3-5 6-4V5l15-3v15c0 4-7 5-8 2-1-3 3-5 6-4V7z" /></> : null}
      {kind === "people" ? <><circle cx="11" cy="9" r="5" /><circle cx="21" cy="10" r="3.5" /><path d="M2 24v-3c0-9 18-9 18 0v3zM21 15c6 0 7 4 6 8h-5c1-3 0-6-1-8z" /></> : null}
      {kind === "organization" ? <><rect x="3" y="3" width="9" height="9" rx="1.5" /><rect x="16" y="3" width="9" height="9" rx="1.5" /><rect x="3" y="16" width="9" height="9" rx="1.5" /><rect x="16" y="16" width="9" height="9" rx="1.5" /></> : null}
      {kind === "folder" ? <path d="M2 7a2 2 0 0 1 2-2h7l3 3h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" /> : null}
    </g>
  </svg>;
}
