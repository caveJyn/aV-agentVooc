import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import viteCompression from "vite-plugin-compression";
import path from "node:path";

export default defineConfig(({ mode }) => {
    const envDir = path.resolve(__dirname, "..");
    const env = loadEnv(mode, envDir, "");
    return {
        plugins: [
            react(),
            viteCompression({
                algorithm: "brotliCompress",
                ext: ".br",
                threshold: 1024,
            }),
        ],
        clearScreen: false,
        envDir,
        define: {
            "import.meta.env.VITE_SERVER_PORT": JSON.stringify(
                env.SERVER_PORT
            ),
            "import.meta.env.VITE_SERVER_URL": JSON.stringify(
                env.SERVER_URL 
            ),
            "import.meta.env.VITE_SERVER_BASE_URL": JSON.stringify(
                env.VITE_SERVER_BASE_URL
            ),
            // Supertokens frontend config
            "import.meta.env.VITE_ST_SERVER_BASE_URL": JSON.stringify(
                env.VITE_ST_SERVER_BASE_URL
            ),
            "import.meta.env.VITE_ST_WEBSITE_DOMAIN": JSON.stringify(
                env.VITE_ST_WEBSITE_DOMAIN
            ),
            // Clerk
            "import.meta.env.VITE_CLERK_PUBLISHABLE_KEY": JSON.stringify(
                env.VITE_CLERK_PUBLISHABLE_KEY
            ),
            "import.meta.env.VITE_CHIPI_PUBLIC_API_KEY": JSON.stringify(
                env.CHIPI_PUBLIC_API_KEY
            ),
            "import.meta.env.VITE_STARKNET_NODE_URL": JSON.stringify(
                env.STARKNET_NODE_URL
            )
        },
        build: {
            outDir: "dist",
            minify: true,
            cssMinify: true,
            sourcemap: false,
            cssCodeSplit: true,
        },
        resolve: {
            alias: {
                "@": "/src",
            },
        },
        server: {
            host: "0.0.0.0", // Bind to all interfaces
            port: 5173
        }
    };
});