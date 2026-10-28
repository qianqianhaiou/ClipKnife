import { useEffect, useState, type ReactNode, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ImageOff, RefreshCw, X } from "lucide-react";

const photos = import.meta.glob<string>("../assets/*.webp", { eager: true, query: "?url", import: "default" });
const photoFocus: Record<string, string> = { traveler: "72% center" };
export function photoUrl(name: string, full = false) { return photos[`../assets/${name}${full ? "" : "-thumb"}.webp`]; }
export function Photo({ name, alt, full = false, eager = false, retry = false }: { name: string; alt: string; full?: boolean; eager?: boolean; retry?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setFailed(false); setAttempt(0); }, [name, full]);
  const url = photoUrl(name, full);
  return failed || !url ? <span className="photo-error" aria-label={`${alt}，图片暂未加载`}><ImageOff /><span>图片暂未加载</span>{retry && <button type="button" onClick={event => { event.stopPropagation(); setFailed(false); setAttempt(value => value + 1); }} aria-label={`重新加载${alt}`}><RefreshCw />重试</button>}</span>
    : <img key={`${name}-${full}-${attempt}`} src={url} alt={alt} style={{ objectPosition: photoFocus[name] }} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />;
}
export function Modal({ open, title, description, children, onClose, className = "", returnFocus, initialFocus }: {
  open: boolean; title: string; description: string; children: ReactNode; onClose: () => void;
  className?: string; returnFocus?: RefObject<HTMLElement | null>; initialFocus?: RefObject<HTMLElement | null>;
}) {
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={`dialog ${className}`}
      onCloseAutoFocus={event => { if (returnFocus?.current?.isConnected) { event.preventDefault(); returnFocus.current.focus({ preventScroll: true }); } }}
      onOpenAutoFocus={event => { if (initialFocus?.current) { event.preventDefault(); initialFocus.current.focus(); } }}>
      <header className="dialog-header"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close className="icon-button" aria-label="关闭弹窗"><X /></Dialog.Close></header>
      {children}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <Select.Root value={value || "__all"} onValueChange={next => onChange(next === "__all" ? "" : next)}>
    <Select.Trigger className="select-trigger" aria-label={label}><Select.Value /><Select.Icon><ChevronDown /></Select.Icon></Select.Trigger>
    <Select.Portal><Select.Content className="select-content" position="popper" sideOffset={5} collisionPadding={12}>
      <Select.Viewport>{options.map(option => <Select.Item className="select-item" key={option.value} value={option.value || "__all"}>
        <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check /></Select.ItemIndicator>
      </Select.Item>)}</Select.Viewport>
    </Select.Content></Select.Portal>
  </Select.Root>;
}
export function Empty({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="empty-state"><span className="empty-symbol"><ImageOff /></span><h2>{title}</h2><p>{text}</p>{children}</div>;
}
