import { defineConfig } from "vite";

export default defineConfig({
  // 상대 경로로 빌드 → GitHub Pages(하위 경로)와 Vercel(루트) 양쪽 모두에서 동작
  base: "./",
});
