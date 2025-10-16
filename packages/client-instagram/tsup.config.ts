import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"],
    external: [
        "sharp",
        "fs",
        "path",
        "instagram-private-api",
        "@elizaos/core",
        // Add other externals as needed
    ],
});