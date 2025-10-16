import { elizaLogger, UUID } from "@elizaos/core";
import SuperTokensNode from "supertokens-node";
import SessionNode from "supertokens-node/recipe/session";

export interface SessionUserAndToken {
  userId: UUID;
  sAccessToken: string;
  sRefreshToken?: string;
}

SuperTokensNode.init({
  framework: "express",
   supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
      apiKey: process.env.SUPERTOKENS_API_KEY || "",
    },
    appInfo: {
      appName: "agentVooc",
      apiDomain: process.env.ST_SERVER_BASE_URL,
      websiteDomain: process.env.ST_WEBSITE_DOMAIN,
      apiBasePath: "/api/auth",
      websiteBasePath: "/auth",
  },
  recipeList: [SessionNode.init()],
});
elizaLogger.info("[SHARED-EMAIL-SANITY] SuperTokens initialized for Node.js");

export async function getSessionUserAndToken(
  accessToken?: string,
  refreshToken?: string
): Promise<SessionUserAndToken | null> {
  try {
    if (!accessToken) {
      elizaLogger.error("[SHARED-EMAIL-SANITY] No accessToken provided");
      return null;
    }

    elizaLogger.debug("[SHARED-EMAIL-SANITY] Attempting to verify accessToken", {
      accessToken: `[REDACTED_${accessToken.slice(-4)}]`,
      refreshToken: refreshToken ? `[REDACTED_${refreshToken.slice(-4)}]` : null,
    });

    // Try verifying the token directly
    const session = await SessionNode.getSessionWithoutRequestResponse(
  accessToken,
  undefined,
  { sessionRequired: false }
);
if (!session) {
  elizaLogger.error("[SHARED-EMAIL-SANITY] No session exists for provided accessToken", {
    accessToken: `[REDACTED_${accessToken.slice(-4)}]`,
    tokenPayload: accessToken ? JSON.parse(Buffer.from(accessToken.split(".")[1], "base64").toString()) : null,
  });
  return null;
}

    const userId = session.getUserId();
    const sAccessToken = session.getAccessToken();

    elizaLogger.info("[SHARED-EMAIL-SANITY] Session details", {
      userId,
      sAccessToken: sAccessToken ? `[REDACTED_${sAccessToken.slice(-4)}]` : null,
      accessTokenPayload: session.getAccessTokenPayload(),
    });

    if (!userId || !sAccessToken) {
      elizaLogger.error("[SHARED-EMAIL-SANITY] Session missing userId or accessToken", {
        userId: userId || "none",
        sAccessToken: sAccessToken ? `[REDACTED_${sAccessToken.slice(-4)}]` : null,
      });
      return null;
    }

    return {
      userId: userId as UUID,
      sAccessToken,
      sRefreshToken: refreshToken,
    };
  } catch (error: any) {
    elizaLogger.error("[SHARED-EMAIL-SANITY] Failed to retrieve session user and token", {
      message: error.message,
      stack: error.stack,
      accessToken: accessToken ? `[REDACTED_${accessToken.slice(-4)}]` : null,
    });
    return null;
  }
}