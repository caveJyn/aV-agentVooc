import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"], // Ensure you're targeting CommonJS
    dts: true, // Ensure type declarations are generated
    external: [
        "nodemailer",
        "mail-notifier",
        "z",
        "@elizaos/core",
        "@elizaos/core",
    "@elizaos-plugins/plugin-shared-email-sanity"
    ],
});
