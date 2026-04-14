import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },

  build: {
    rollupOptions: {
      output: {
        // Fine-grained chunks → better long-term caching (each chunk hashed separately)
        manualChunks: {
          "react-core": ["react", "react-dom"],
          "router":     ["react-router-dom"],
          "pdflib":     ["pdf-lib"],
          "pdfjs":      ["pdfjs-dist"],
          "tesseract":  ["tesseract.js"],
          "icons":      ["react-icons/fa"],
        },
      },
    },

    // Warn at 700 kB (pdfjs + pdflib are legitimately large WASM bundles)
    chunkSizeWarningLimit: 700,

    // No source maps in production — reduces bundle size and hides implementation
    sourcemap: false,

    // esbuild is faster than terser and produces nearly identical output
    minify: "esbuild",

    // Drop console.log statements in production build
    esbuildOptions: {
      drop: ["console", "debugger"],
    },

    // Assets inlined below 4 kB (icons, small images)
    assetsInlineLimit: 4096,

    // CSS code-splitting: each lazy page loads only its own CSS
    cssCodeSplit: true,
  },

  // Pre-bundle heavy libs during dev to avoid page reloads on first import
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "react-icons/fa", "pdf-lib"],
  },
});
