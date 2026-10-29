import "./fallback.css";

type DemoRuntime = { mountDemo: (embed: boolean) => void };
declare global { interface Window { ClipKnifeDemo?: DemoRuntime } }
// Capture during evaluation: currentScript is null after an asynchronous load.
const entryScript = document.currentScript instanceof HTMLScriptElement ? document.currentScript
  : document.querySelector<HTMLScriptElement>('script[type="module"][src$="/entry.ts"]');
const entryUrl = entryScript?.src;

async function loadRuntime(): Promise<DemoRuntime> {
  if (!entryUrl) throw new Error("Missing demo entry URL");
  if (import.meta.env.DEV) {
    const runtime: unknown = await import(/* @vite-ignore */ new URL("./main.tsx", entryUrl).href);
    if (typeof runtime !== "object" || runtime === null || !("mountDemo" in runtime)
      || typeof runtime.mountDemo !== "function") throw new Error("Missing demo mount function");
    return { mountDemo: runtime.mountDemo as DemoRuntime["mountDemo"] };
  }
  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("./main.css", entryUrl).href;
  const script = document.createElement("script");
  script.src = new URL("./main.js", entryUrl).href;
  const resources = [style, script];
  try {
    await Promise.all(resources.map(resource => new Promise<void>((resolve, reject) => {
      resource.onload = () => resolve();
      resource.onerror = () => reject(new Error(`Cannot load demo ${resource.tagName.toLowerCase()}`));
      document.head.appendChild(resource);
    })));
    if (typeof window.ClipKnifeDemo?.mountDemo !== "function") throw new Error("Missing demo mount function");
    return window.ClipKnifeDemo;
  } catch (error) {
    resources.forEach(resource => resource.remove());
    throw error;
  } finally {
    resources.forEach(resource => { resource.onload = null; resource.onerror = null; });
  }
}

const embed = new URLSearchParams(window.location.search).get("embed") === "1";
const wide = window.matchMedia(embed ? "(min-width: 960px)" : "(min-width: 1024px)");
document.documentElement.dataset.embed = String(embed);
let started = false;
let failed = false;
const retry = document.querySelector<HTMLButtonElement>(".fallback-retry");
retry?.addEventListener("click", () => window.location.reload());

async function mount() {
  if (started || !wide.matches) return;
  started = true;
  try {
    const { mountDemo } = await loadRuntime();
    mountDemo(embed);
  } catch (error) {
    failed = true;
    document.documentElement.dataset.demoError = "true";
    const status = document.querySelector<HTMLElement>(".fallback-loading");
    if (status) status.textContent = "演示暂未加载成功，请重试。";
    if (retry) retry.hidden = false;
    const visual = document.querySelector(".fallback-visual");
    if (visual && status) visual.before(status);
    if (visual && retry) visual.before(retry);
    console.error("Demo module failed to load", error instanceof Error ? error.message : "unknown error");
  }
}
wide.addEventListener("change", () => { if (!failed) void mount(); });
void mount();
