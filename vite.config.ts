import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 620,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three-renderer";
          if (id.includes("/node_modules/astronomy-engine/")) return "sky-model";
          if (id.includes("/node_modules/react/") || id.includes("/node_modules/react-dom/")) return "interface-runtime";
          return undefined;
        },
      },
    },
  },
});
