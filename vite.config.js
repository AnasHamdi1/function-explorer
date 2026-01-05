import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        ar: resolve(__dirname, "ar.html"),
      },
    },
  },
  base: "/function-explorer/",
});
