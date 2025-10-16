import { defineConfig } from "tsup";

export default defineConfig({
    entry: ['src/index.ts', 'src/client.ts'],
    outDir: "dist",
    sourcemap: true,
    dts: true, 
    clean: true,
    format: ["esm"], // Ensure you're targeting CommonJS,
    external: [
        "@elizaos/core",
        "dotenv", // Externalize dotenv to prevent bundling
        "fs", // Externalize fs to use Node.js built-in module
        "path", // Externalize other built-ins if necessary
        "@reflink/reflink",
        "@node-llama-cpp",
        "https",
        "http",
        "agentkeepalive",
        // Add other modules you want to externalize
    ],
});
