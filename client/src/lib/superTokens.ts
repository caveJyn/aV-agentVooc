import SuperTokens from "supertokens-web-js";
import { frontendConfig } from "../config/frontendConfig";

let isInitialized = false;

export function initSuperTokens() {
    if (!isInitialized && typeof window !== "undefined") {
        try {
            SuperTokens.init(frontendConfig());
            isInitialized = true;
            console.log(
                `SuperTokens initialized with apiDomain: ${frontendConfig().appInfo.apiDomain}, ` +
                `apiBasePath: ${frontendConfig().appInfo.apiBasePath}`
            );
        } catch (error) {
            console.error("Failed to initialize SuperTokens:", error);
        }
    } else {
        console.warn("SuperTokens not initialized: ", { isInitialized, isWindowDefined: typeof window !== "undefined" });
    }
}