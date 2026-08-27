import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  envPrefix: ["VITE_", "TAURI_ENV_*", "TAURI_PLATFORM", "TAURI_ARCH", "TAURI_FAMILY", "TAURI_PLATFORM_VERSION", "TAURI_PLATFORM_TYPE", "TAURI_DEBUG"],
});
