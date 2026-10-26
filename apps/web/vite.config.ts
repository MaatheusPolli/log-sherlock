import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// A API (apps/api) roda em 3333 por padrão; o front fala com ela via /api.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": { target: process.env.SHERLOCK_API ?? "http://127.0.0.1:3333", changeOrigin: false } },
  },
});
