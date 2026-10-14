import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Ports come from the repo-root .env (if present); explicit environment variables win.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const envFile = path.join(repoRoot, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const apiPort = Number(process.env.ADLAB_API_PORT || 8787);
const webPort = Number(process.env.ADLAB_WEB_PORT || 5173);
const api = `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: webPort,
    strictPort: true,
    proxy: {
      "/v1": { target: api, changeOrigin: false },
      "/files": { target: api, changeOrigin: false },
    },
  },
  preview: { port: webPort, strictPort: true, proxy: { "/v1": api, "/files": api } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
