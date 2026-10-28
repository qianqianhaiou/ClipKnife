import "./fallback.css";

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
    const { mountDemo } = await import("./main");
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
