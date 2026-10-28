import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL(".build", import.meta.url)),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: fileURLToPath(new URL("index.html", import.meta.url)),
      output: {
        entryFileNames: "assets/demo/entry.js",
        chunkFileNames: "assets/demo/[name].js",
        assetFileNames: "assets/demo/[name][extname]",
      },
    },
  },
  server: { host: "127.0.0.1", port: 41388, strictPort: true },
});
