import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./demo.css";

class DemoBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="empty-state"><h1>演示暂时遇到问题</h1><p>示例数据可以安全重置，重新开始体验。</p><button className="button primary" onClick={() => {
      try { sessionStorage.removeItem("clipknife:website-demo:v1"); } catch { /* Reload still works when storage is unavailable. */ }
      location.reload();
    }}>重置并重新加载</button><a href="../">返回官网</a></main> : this.props.children;
  }
}
export function mountDemo(embed: boolean) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing demo root");
  createRoot(root).render(<StrictMode><DemoBoundary><App embed={embed} /></DemoBoundary></StrictMode>);
}
