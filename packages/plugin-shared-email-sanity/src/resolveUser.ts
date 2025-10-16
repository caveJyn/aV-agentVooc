import { elizaLogger, SanityUser } from "@elizaos/core";
import { sanityClient } from "./emailTemplate";

export interface CreatedByRef {
  _type: "reference";
  _ref: string;
}

export async function resolveUserIdFromCreatedBy(createdBy: CreatedByRef | SanityUser | undefined): Promise<string> {
  if (!createdBy || typeof createdBy !== "object") {
    elizaLogger.warn(`[SHARED-EMAIL-SANITY] Invalid createdBy format, expected reference object or SanityUser`, { createdBy });
    return "unknown";
  }

  // Handle SanityUser case
  if ("userId" in createdBy && createdBy.userId) {
    elizaLogger.debug(`[SHARED-EMAIL-SANITY] Resolved userId directly from SanityUser`, {
      userId: createdBy.userId,
    });
    return createdBy.userId;
  }

  // Handle CreatedByRef case
  if ("_ref" in createdBy && createdBy._type === "reference") {
    try {
      const user = await sanityClient.fetch(
        `*[_type == "User" && _id == $ref][0]{userId}`,
        { ref: createdBy._ref }
      );

      if (user?.userId) {
        elizaLogger.debug(`[SHARED-EMAIL-SANITY] Resolved userId from createdBy ref`, {
          userId: user.userId,
          ref: createdBy._ref,
        });
        return user.userId;
      } else {
        elizaLogger.warn(`[SHARED-EMAIL-SANITY] No userId found for createdBy ref: ${createdBy._ref}`);
        return "unknown";
      }
    } catch (error: any) {
      elizaLogger.error(`[SHARED-EMAIL-SANITY] Failed to resolve userId from createdBy ref: ${createdBy._ref}`, {
        error: error.message,
        stack: error.stack,
      });
      return "unknown";
    }
  }

  elizaLogger.warn(`[SHARED-EMAIL-SANITY] Invalid createdBy format, missing userId or _ref`, { createdBy });
  return "unknown";
}