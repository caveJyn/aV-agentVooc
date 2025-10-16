import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  sourcemap: true,
  clean: true,
  format: ["esm"],
  external: [
    "zod",
    "@elizaos/core",
    "@elizaos-plugins/plugin-email",
    "sats-connect",
    "bitcoinjs-lib",
    "@sendgrid/mail",
    "zod",
    "dotenv",
    "child_process",
    "util"
  ],
});