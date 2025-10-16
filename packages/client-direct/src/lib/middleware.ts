import { Request, Response, NextFunction } from "express";
import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";
import { elizaLogger, stringToUuid } from "@elizaos/core";
import { sanityClient } from "@elizaos-plugins/plugin-sanity";

export interface AuthRequest extends Request {
  userId?: string; // Sanity UUID
  clerkUserId?: string; // Clerk ID (kept for compatibility but not stored)
}

export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

  if (!secretKey || !publishableKey) {
    elizaLogger.error("[CLERK_MIDDLEWARE] Missing Clerk configuration");
    return res.status(500).json({ error: "Server configuration error" });
  }

  elizaLogger.debug("[CLERK_MIDDLEWARE] Processing authentication");

  return ClerkExpressRequireAuth()(req, res, async (err) => {
    if (err) {
      elizaLogger.error("[CLERK_MIDDLEWARE] Authentication failed", {
        message: err.message,
        stack: err.stack,
      });
      return res.status(401).json({ error: "Unauthorized: Invalid or missing token" });
    }

    const auth = (req as any).auth;
    if (!auth?.userId) {
      elizaLogger.error("[CLERK_MIDDLEWARE] No userId in auth object");
      return res.status(401).json({ error: "Unauthorized: Missing Clerk user ID" });
    }

    const clerkUserId = auth.userId;
    const userId = stringToUuid(clerkUserId); // Derive deterministic userId

    try {
      const maxRetries = 3;
      let user;
      for (let i = 0; i < maxRetries; i++) {
        try {
          user = await sanityClient.fetch(
            `*[_type == "User" && userId == $userId][0]{userId}`,
            { userId }
          );
          break;
        } catch (error) {
          if (i === maxRetries - 1) {
            elizaLogger.error("[CLERK_MIDDLEWARE] Failed to fetch user after retries", {
              userId,
              message: error.message,
              stack: error.stack,
            });
            return res.status(500).json({ error: "Server error: Failed to fetch user data" });
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!user?.userId) {
        elizaLogger.error("[CLERK_MIDDLEWARE] No Sanity user found for derived userId", { userId });
        return res.status(401).json({ error: "Unauthorized: User not found in database" });
      }

      req.userId = user.userId;
      req.clerkUserId = clerkUserId; // Optional: keep for logging or compatibility
      elizaLogger.info("[CLERK_MIDDLEWARE] Authenticated", { userId });
      next();
    } catch (error) {
      elizaLogger.error("[CLERK_MIDDLEWARE] Failed to process authentication", {
        userId,
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: "Server error: Failed to process authentication" });
    }
  });
};

/**
 * Middleware to ensure the user has an active trial or subscription.
 * Checks trial status or active subscription; redirects to subscription page if neither is valid.
 */
export const requireActiveSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    if (!userId) {
      elizaLogger.warn("[SUBSCRIPTION_MIDDLEWARE] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const maxRetries = 3;
    let user;
    for (let i = 0; i < maxRetries; i++) {
      try {
        user = await sanityClient.fetch(
          `*[_type == "User" && userId == $userId][0]{subscriptionStatus, trialEndDate, hasUsedTrial}`,
          { userId }
        );
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          elizaLogger.error("[SUBSCRIPTION_MIDDLEWARE] Failed to fetch user after retries", {
            userId,
            message: error.message,
            stack: error.stack,
          });
          return res.status(500).json({ error: "Server error: Failed to fetch user data" });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!user) {
      elizaLogger.warn("[SUBSCRIPTION_MIDDLEWARE] User not found", { userId });
      return res.status(404).json({ error: "User not found in database" });
    }

    const now = new Date();
    const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
    const isTrialActive = user.subscriptionStatus === "trialing" && trialEndDate && now <= trialEndDate;
    const isSubscribed = user.subscriptionStatus === "active";

    if (!isTrialActive && !isSubscribed) {
      elizaLogger.warn("[SUBSCRIPTION_MIDDLEWARE] Access restricted", {
        userId,
        subscriptionStatus: user.subscriptionStatus,
        trialEndDate: user.trialEndDate,
      });
      return res.status(403).json({
        error: user.trialEndDate && now > trialEndDate
          ? "Your trial has expired. Please subscribe to continue."
          : "No active subscription or trial. Please subscribe to continue.",
        action: "subscribe",
        redirect: `${process.env.WEBSITE_DOMAIN}/subscribe`,
      });
    }

    elizaLogger.debug("[SUBSCRIPTION_MIDDLEWARE] Subscription check passed", {
      userId,
      isTrialActive,
      isSubscribed,
    });
    next();
  } catch (error) {
    elizaLogger.error("[SUBSCRIPTION_MIDDLEWARE] Error checking subscription", {
      userId: req.userId,
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: "Server error: Failed to verify subscription status" });
  }
};