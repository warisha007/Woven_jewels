import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        "index-static": resolve(root, "index-static.html"),
        collections: resolve(root, "collections.html"),
        "our-story": resolve(root, "our-story.html"),
        "product-details": resolve(root, "product-details.html"),
        "order-summary": resolve(root, "order-summary.html"),
        checkout: resolve(root, "checkout.html"),
        payment: resolve(root, "payment.html"),
        admin: resolve(root, "admin.html")
      }
    }
  }
});
