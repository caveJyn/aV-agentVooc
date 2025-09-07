import supertokens from "supertokens-node";
import { backendConfig } from "./config/backendConfig";
import { elizaLogger } from "@elizaos/core";

// Initialize SuperTokens using backendConfig
supertokens.init(backendConfig());

elizaLogger.info(
    `SuperTokens initialized with apiDomain: ${process.env.API_DOMAIN || "http://localhost:3000"}, ` +
    `websiteDomain: ${process.env.WEBSITE_DOMAIN || "http://localhost:5173"}, ` +
    `apiBasePath: /api/auth`
);

export default supertokens;