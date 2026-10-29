import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL("..", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL(".build", import.meta.url)),
    emptyOutDir: mode !== "demo-runtime",
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: fileURLToPath(new URL(mode === "demo-runtime" ? "src/main.tsx" : "index.html", import.meta.url)),
      preserveEntrySignatures: mode === "demo-runtime" ? "strict" : false,
      output: {
        format: "iife",
        name: "ClipKnifeDemo",
        entryFileNames: mode === "demo-runtime" ? "assets/demo/main.js" : "assets/demo/entry.js",
        assetFileNames: asset => asset.names.includes("style.css")
          ? `assets/demo/${mode === "demo-runtime" ? "main" : "index"}.css`
          : "assets/demo/[name][extname]",
      },
    },
  },
  server: { host: "127.0.0.1", port: 41388, strictPort: true },
}));
