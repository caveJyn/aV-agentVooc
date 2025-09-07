import express from "express";
import { Router } from 'express';
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";

import {
    type AgentRuntime,
    elizaLogger,
    getEnvVariable,
    type UUID,
    validateCharacterConfig,
    ServiceType,
    type Character,
    stringToUuid
} from "@elizaos/core";

// import type { TeeLogQuery, TeeLogService } from "@elizaos/plugin-tee-log";
// import { REST, Routes } from "discord.js";
import type { DirectClient } from ".";
import { validateUuid } from "@elizaos/core";
import SuperTokens from "supertokens-node";
import { middleware, errorHandler } from "supertokens-node/framework/express";
import { backendConfig } from "./config/backendConfig";
import { sanityClient, urlFor } from "@elizaos-plugins/plugin-sanity";
import Session from "supertokens-node/recipe/session";
import Stripe from "stripe";
// import fetch from "node-fetch"; // Add this import for microservice requests
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "your-secret-key", {
  apiVersion: "2025-04-30.basil",
});


// Define the Item interface
interface Item {
    id: string;
    name: string;
    description: string;
    price: number; // Price in cents (e.g., 1000 = $10.00)
    itemType?: string; // Optional, set for Sanity items, undefined for others
    source?: string; // Optional: Indicates where the item came from
    features?: string[]; // Optional: List of features for the item
    isPopular?: boolean; // Optional: Indicates if the item is popular
    trialInfo?: string; // Optional: Information about trial details
    useCase?: string; // Optional: Describes the use case for the item
}


interface UUIDParams {
    agentId: UUID;
    roomId?: UUID;
}

function validateUUIDParams(
    params: { agentId: string; roomId?: string },
    res: express.Response
): UUIDParams | null {
    const agentId = validateUuid(params.agentId);
    if (!agentId) {
        res.status(400).json({
            error: "Invalid AgentId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        });
        return null;
    }

    if (params.roomId) {
        const roomId = validateUuid(params.roomId);
        if (!roomId) {
            res.status(400).json({
                error: "Invalid RoomId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            });
            return null;
        }
        return { agentId, roomId };
    }

    return { agentId };
}


// Rate limiter for /checkout-session
const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 requests per window
  });

  
export function createApiRouter(
    agents: Map<string, IAgentRuntime>,
    directClient: DirectClient
):Router {
    const router = express.Router();




    router.use(
        express.json({
            limit: getEnvVariable("EXPRESS_MAX_PAYLOAD") || "100kb",
        })
    );

     // Add SuperTokens middleware for authentication routes
    // Debug middleware to log requests
    router.use((req, res, next) => {
        elizaLogger.debug(`Request received: ${req.method} ${req.originalUrl}`);
        next();
    });
    router.get("/", (req, res) => {
        res.send("Welcome, this is the REST API!");
    });
    

    router.get("/hello", (req, res) => {
        res.json({ message: "Hello World!" });
    });
// ... inside createApiRouter
router.post("/crypto-auth", async (req, res) => {
    try {
      const { walletAddress } = req.body;
      const userId = walletAddress; // Use wallet address as userId
      elizaLogger.debug(`Crypto auth attempt for wallet: ${walletAddress}`);
  
      // Create session with userType in accessTokenPayload
      await Session.createNewSession(req, res, userId, { userType: "crypto" });
  
      const existingUser = await sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]`,
        { userId }
      );
      if (!existingUser) {
        const User = await sanityClient.create({
          _type: "User",
          name: "Crypto User",
          email: `${walletAddress}@crypto.example.com`,
          interest: "elizaOS",
          referralSource: "phantom-wallet",
          userId,
          createdAt: new Date().toISOString(),
          userType: "crypto",
        });
        elizaLogger.debug(`Created crypto User: userId=${userId}, _id=${User._id}`);
      }
      res.status(501).json({ message: "Crypto authentication not yet implemented" });
    } catch (error: any) {
      elizaLogger.error("Error in crypto auth:", error);
      res.status(500).json({ error: "Failed to process crypto auth", details: error.message });
    }
  });


  // Webhook handler
   // Webhook handler with raw body parser
   router.post(
    "/webhook",
    bodyParser.raw({ type: "application/json" }),
    async (req, res) => {
      elizaLogger.debug("[WEBHOOK] Received webhook request", {
        headers: req.headers,
        bodyLength: req.body?.length,
        isBuffer: Buffer.isBuffer(req.body),
        bodyType: typeof req.body,
      });
  
      const sig = req.headers["stripe-signature"];
      let event: Stripe.Event;
  
      try {
        if (!process.env.STRIPE_WEBHOOK_SECRET) {
          elizaLogger.error("[WEBHOOK] STRIPE_WEBHOOK_SECRET is not set");
          return res.status(500).json({ error: "Server configuration error: Missing webhook secret" });
        }
  
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
        elizaLogger.debug("[WEBHOOK] Webhook event constructed", { type: event.type, id: event.id });
      } catch (err: any) {
        elizaLogger.error("[WEBHOOK] Webhook signature verification failed", {
          message: err.message,
          signature: sig,
        });
        return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
      }
  
      try {
        switch (event.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated": {
            const subscription = event.data.object as Stripe.Subscription;
            const userId = subscription.metadata?.userId;
            const status = subscription.status;
  
            if (!userId) {
              elizaLogger.warn("[WEBHOOK] No userId in subscription metadata", {
                eventType: event.type,
                subscriptionId: subscription.id,
              });
              return res.status(400).json({ error: "No userId in subscription metadata" });
            }
  
            const user = await sanityClient.fetch(
              `*[_type == "User" && userId == $userId][0]`,
              { userId }
            );
  
            if (!user) {
              elizaLogger.warn("[WEBHOOK] User not found for userId", { userId });
              return res.status(404).json({ error: `User not found for userId: ${userId}` });
            }
  
            await sanityClient
              .patch(user._id)
              .set({
                subscriptionStatus: status,
                stripeSubscriptionId: subscription.id,
                trialStartDate: subscription.trial_start
                  ? new Date(subscription.trial_start * 1000).toISOString()
                  : undefined,
                trialEndDate: subscription.trial_end
                  ? new Date(subscription.trial_end * 1000).toISOString()
                  : undefined,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              })
              .commit();
            elizaLogger.debug("[WEBHOOK] Updated subscription status", {
              userId,
              status,
              subscriptionId: subscription.id,
              trialStartDate: subscription.trial_start
                ? new Date(subscription.trial_start * 1000).toISOString()
                : undefined,
              trialEndDate: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : undefined,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            });
            break;
          }
  
          case "customer.subscription.deleted": {
            const subscription = event.data.object as Stripe.Subscription;
            const userId = subscription.metadata?.userId;
            const status = subscription.status;
  
            if (!userId) {
              elizaLogger.warn("[WEBHOOK] No userId in subscription metadata", {
                eventType: event.type,
                subscriptionId: subscription.id,
              });
              return res.status(400).json({ error: "No userId in subscription metadata" });
            }
  
            const user = await sanityClient.fetch(
              `*[_type == "User" && userId == $userId][0]`,
              { userId }
            );
  
            if (!user) {
              elizaLogger.warn("[WEBHOOK] User not found for userId", { userId });
              return res.status(404).json({ error: `User not found for userId: ${userId}` });
            }
  
            await sanityClient
              .patch(user._id)
              .set({
                subscriptionStatus: status,
                stripeSubscriptionId: null,
                trialStartDate: undefined,
                trialEndDate: undefined,
                cancelAtPeriodEnd: false,
              })
              .commit();
            elizaLogger.debug("[WEBHOOK] Cleared subscription data", {
              userId,
              status,
              subscriptionId: subscription.id,
            });
            break;
          }
  
          case "checkout.session.completed": {
            const session = event.data.object as Stripe.Checkout.Session;
            const sessionUserId = session.metadata?.userId;
  
            if (!sessionUserId) {
              elizaLogger.warn("[WEBHOOK] No userId in session metadata", {
                eventType: event.type,
                sessionId: session.id,
              });
              return res.status(400).json({ error: "No userId in session metadata" });
            }
  
            const sessionUser = await sanityClient.fetch(
              `*[_type == "User" && userId == $userId][0]`,
              { userId: sessionUserId }
            );
  
            if (!sessionUser) {
              elizaLogger.warn("[WEBHOOK] User not found for userId", { userId: sessionUserId });
              return res.status(404).json({ error: `User not found for userId: ${sessionUserId}` });
            }
  
            const subscriptionId = session.subscription as string;
            if (subscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              await sanityClient
                .patch(sessionUser._id)
                .set({
                  subscriptionStatus: subscription.status,
                  stripeSubscriptionId: subscription.id,
                  trialStartDate: subscription.trial_start
                    ? new Date(subscription.trial_start * 1000).toISOString()
                    : undefined,
                  trialEndDate: subscription.trial_end
                    ? new Date(subscription.trial_end * 1000).toISOString()
                    : undefined,
                  cancelAtPeriodEnd: subscription.cancel_at_period_end,
                })
                .commit();
              elizaLogger.debug("[WEBHOOK] Updated subscription status from checkout.session.completed", {
                userId: sessionUserId,
                status: subscription.status,
                subscriptionId: subscription.id,
                trialStartDate: subscription.trial_start
                  ? new Date(subscription.trial_start * 1000).toISOString()
                  : undefined,
                trialEndDate: subscription.trial_end
                  ? new Date(subscription.trial_end * 1000).toISOString()
                  : undefined,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
              });
            } else {
              elizaLogger.warn("[WEBHOOK] No subscription in session", { sessionId: session.id });
            }
            break;
          }
  
          default:
            elizaLogger.debug("[WEBHOOK] Unhandled event type", { type: event.type });
        }
        res.json({ received: true });
      } catch (err: any) {
        elizaLogger.error("[WEBHOOK] Error processing webhook event", {
          eventType: event?.type,
          message: err.message,
          stack: err.stack,
        });
        await sanityClient.create({
          _type: "WebhookError",
          eventType: event?.type,
          errorMessage: err.message,
          timestamp: new Date().toISOString(),
        });
        return res.status(500).json({ error: `Failed to process webhook: ${err.message}` });
      }
    }
  );


  router.post("/checkout-session", checkoutLimiter, async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        elizaLogger.error("STRIPE_SECRET_KEY is not set in environment variables");
        return res.status(500).json({ error: "Server configuration error: Missing Stripe secret key" });
      }
  
      console.log("[API] /checkout-session request body:", req.body);
      const { userId, items } = req.body;
      if (!userId) {
        elizaLogger.warn("Missing userId in /checkout-session request");
        return res.status(400).json({ error: "Missing userId" });
      }
      if (!items || !Array.isArray(items) || items.length === 0) {
        elizaLogger.warn("No items provided in /checkout-session request");
        return res.status(400).json({ error: "At least one item is required" });
      }
  
      // Fetch only subscription items from Sanity
      const sanityItems = await sanityClient.fetch(
        `*[_type == "Item" && itemType == "subscription"]`
      );
      const sanityItemIds = sanityItems.map((item) => item.id);
      const validatedItems = [];
      // Validate Sanity items

for (const item of items) {
  const sanityItem = sanityItems.find((si) => si.id === item.id);
  if (sanityItem && sanityItem.price === item.price) {
    validatedItems.push(sanityItem);
    continue;
  }
  // Allow static items with itemType: "subscription"
  if (item.source === "static" && item.itemType === "subscription") {
    validatedItems.push({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      itemType: item.itemType,
      source: item.source,
    });
    continue;
  }
  elizaLogger.warn(`Invalid subscription item or price: id=${item.id}, price=${item.price}`);
  return res.status(400).json({ error: "Invalid subscription item or price" });
}
  
      const session = await Session.getSession(req, res, { sessionRequired: true });
      const sessionUserId = session.getUserId();
      if (userId !== sessionUserId) {
        elizaLogger.warn(`User ID mismatch: request=${userId}, session=${sessionUserId}`);
        return res.status(403).json({ error: "User ID does not match session" });
      }
  
      const user = await sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]`,
        { userId }
      );
  
      if (!user) {
        elizaLogger.warn(`No User found in Sanity for userId=${userId}`);
        return res.status(404).json({ error: "User not found in Sanity" });
      }
  
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
        await sanityClient
          .patch(user._id)
          .set({ stripeCustomerId })
          .commit();
        elizaLogger.debug(`Created Stripe customer for userId=${userId}: customerId=${stripeCustomerId}`);
      }
  
      // Deactivate Stripe prices not linked to Sanity subscription items
      const stripeProducts = await stripe.products.list({ limit: 100 });
      for (const product of stripeProducts.data) {
        // Skip products linked to Sanity subscription items
        if (sanityItemIds.includes(product.metadata.sanityItemId)) {
          continue;
        }
  
        // Deactivate all prices for this product
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 100,
        });
        for (const price of prices.data) {
          await stripe.prices.update(price.id, { active: false });
          elizaLogger.debug(`Deactivated Stripe price ${price.id} for unlinked product ${product.id}`);
        }
  
        // Archive the product
        await stripe.products.update(product.id, { active: false });
        elizaLogger.debug(`Archived unlinked Stripe product ${product.id}`);
      }
  
      // Sync Sanity subscription items with Stripe products and prices
      const lineItems = [];
      for (const item of validatedItems) {
        // Check if product exists in Stripe
        let product = stripeProducts.data.find((p) => p.metadata.sanityItemId === item.id);
  
        if (!product) {
          product = await stripe.products.create({
            name: item.name,
            description: item.description,
            metadata: { sanityItemId: item.id },
            active: true,
          });
          elizaLogger.debug(`Created Stripe product for subscription item ${item.id}: productId=${product.id}`);
        } else if (product.name !== item.name || product.description !== item.description || !product.active) {
          product = await stripe.products.update(product.id, {
            name: item.name,
            description: item.description,
            active: true,
          });
          elizaLogger.debug(`Updated Stripe product ${product.id} for subscription item ${item.id}`);
        }
  
        // Check if price exists in Stripe
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
          recurring: { interval: "month" },
          limit: 1,
        });
        let price = prices.data[0];
  
        if (!price || price.unit_amount !== item.price) {
          if (price) {
            await stripe.prices.update(price.id, { active: false });
            elizaLogger.debug(`Deactivated old Stripe price ${price.id} for product ${product.id}`);
          }
          price = await stripe.prices.create({
            product: product.id,
            unit_amount: item.price,
            currency: "usd",
            recurring: { interval: "month" },
            metadata: { sanityItemId: item.id },
          });
          elizaLogger.debug(`Created Stripe price ${price.id} for subscription item ${item.id}`);
        }
  
        lineItems.push({
          price: price.id,
          quantity: 1,
        });
  
        // Store stripePriceId in Sanity if missing
        if (!item.stripePriceId || item.stripePriceId !== price.id) {
          await sanityClient
            .patch(item._id)
            .set({ stripePriceId: price.id })
            .commit();
          elizaLogger.debug(`Updated Sanity subscription item ${item.id} with stripePriceId=${price.id}`);
        }
      }
  
      elizaLogger.debug(`Creating Checkout Session for userId=${userId} with customerId=${stripeCustomerId} and ${lineItems.length} items`);
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "subscription",
        success_url: "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:5173/cancel",
        metadata: { userId },
        customer: stripeCustomerId,
        billing_address_collection: "auto",
        subscription_data: {
          trial_period_days: user.trialStartDate ? 0 : 7,
          metadata: { userId },
        },
      });
  
      if (!checkoutSession.url) {
        elizaLogger.error("Checkout Session created but URL is missing", checkoutSession);
        return res.status(500).json({ error: "Failed to generate checkout session URL" });
      }
  
      if (checkoutSession.subscription) {
        await stripe.subscriptions.update(checkoutSession.subscription as string, {
          metadata: { userId },
        });
        elizaLogger.debug(`Updated subscription ${checkoutSession.subscription} with userId=${userId} in metadata`);
      }
  
      elizaLogger.debug(`Checkout Session created successfully: id=${checkoutSession.id}`);
      const response = { checkoutUrl: checkoutSession.url };
      console.log("[API] /checkout-session response:", response);
      res.json(response);
    } catch (error: any) {
      elizaLogger.error("Error in checkout-session:", {
        message: error.message,
        type: error.type,
        code: error.code,
        raw: error.raw,
      });
      res.status(500).json({ error: "Failed to create checkout session", details: error.message });
    }
  });


router.get("/subscription-status", async (req, res) => {
    try {
        const session = await Session.getSession(req, res, { sessionRequired: true });
        const userId = session.getUserId();

        const user = await sanityClient.fetch(
            `*[_type == "User" && userId == $userId][0]`,
            { userId }
        );

        if (!user) {
            elizaLogger.warn(`User not found for userId=${userId}`);
            return res.status(404).json({ error: "User not found" });
        }

        const now = new Date();
        const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
        const isTrialActive = trialEndDate && now <= trialEndDate;

        res.json({
            status: user.subscriptionStatus || "none",
            isTrialActive,
        });
    } catch (error: any) {
        elizaLogger.error("Error in /subscription-status endpoint:", error);
        res.status(500).json({ error: "Failed to fetch subscription status" });
    }
});
// Cancel Subscription Endpoint
router.post("/cancel-subscription", checkoutLimiter, async (req, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY) {
        elizaLogger.error("STRIPE_SECRET_KEY is not set in environment variables");
        return res.status(500).json({ error: "Server configuration error: Missing Stripe secret key" });
      }
  
      const session = await Session.getSession(req, res, { sessionRequired: true });
      const userId = session.getUserId();
  
      const user = await sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]`,
        { userId }
      );
  
      if (!user) {
        elizaLogger.warn(`No User found in Sanity for userId=${userId}`);
        return res.status(404).json({ error: "User not found in Sanity" });
      }
  
      const stripeSubscriptionId = user.stripeSubscriptionId;
      if (!stripeSubscriptionId) {
        elizaLogger.warn(`No subscription found for userId=${userId}`);
        return res.status(400).json({ error: "No active subscription found" });
      }
  
      // Set subscription to cancel at period end
      const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
  
      // Update Sanity with the new subscription status
      await sanityClient
        .patch(user._id)
        .set({
          subscriptionStatus: subscription.status, // Should still be "active" or "trialing"
          cancelAtPeriodEnd: true,
        })
        .commit();
  
      elizaLogger.debug(`Subscription ${stripeSubscriptionId} for userId=${userId} set to cancel at period end`);
      res.json({ message: "Subscription will cancel at the end of the billing period" });
    } catch (error: any) {
      elizaLogger.error("Error in cancel-subscription:", {
        message: error.message,
        type: error.type,
        code: error.code,
        raw: error.raw,
      });
      res.status(500).json({ error: "Failed to cancel subscription", details: error.message });
    }
  });
  
router.post("/create-portal-session", async (req, res) => {
    try {
        const session = await Session.getSession(req, res, { sessionRequired: true });
        const userId = session.getUserId();
        const user = await sanityClient.fetch(
            `*[_type == "User" && userId == $userId][0]`,
            { userId }
        );
        if (!user) {
            elizaLogger.warn(`User not found for userId=${userId}`);
            return res.status(404).json({ error: "User not found" });
        }
        const subscriptions = await stripe.subscriptions.list({ customer: user.stripeCustomerId });
        if (!subscriptions.data.length) {
            elizaLogger.warn(`No subscription found for userId=${userId}`);
            return res.status(404).json({ error: "No subscription found" });
        }
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: "http://localhost:5173/home",
        });
        res.json({ url: portalSession.url });
    } catch (error: any) {
        elizaLogger.error("Error in /create-portal-session endpoint:", error);
        res.status(500).json({ error: "Failed to create portal session" });
    }
});

router.get("/sync-subscriptions", async (req, res) => {
    try {
        const users = await sanityClient.fetch(`*[_type == "User"]`);
        for (const user of users) {
            if (user.stripeCustomerId) {
                const subscriptions = await stripe.subscriptions.list({ customer: user.stripeCustomerId });
                const activeSub = subscriptions.data.find(sub => ["active", "trialing", "past_due"].includes(sub.status));
                if (activeSub && activeSub.status !== user.subscriptionStatus) {
                    await sanityClient
                        .patch(user._id)
                        .set({ subscriptionStatus: activeSub.status })
                        .commit();
                    elizaLogger.debug(`Synced subscription for user ${user.userId}: ${activeSub.status}`);
                }
            }
        }
        res.json({ success: true });
    } catch (error: any) {
        elizaLogger.error("Error in /sync-subscriptions endpoint:", error);
        res.status(500).json({ error: "Failed to sync subscriptions" });
    }
});

    router.get("/agents", async (req, res) => {
    try {
      elizaLogger.debug("Fetching all agents from agents Map");
      const agentsList = Array.from(agents.values()).map((agent) => ({
        id: agent.agentId,
        name: agent.character.name,
        username: agent.character.username,
        bio: agent.character.bio,
        clients: Object.keys(agent.clients),
      }));

      elizaLogger.debug(`Returning ${agentsList.length} agents`, {
        agents: agentsList.map((agent) => ({
          id: agent.id,
          name: agent.name,
        })),
      });

      res.json({ agents: agentsList });
    } catch (error) {
      elizaLogger.error("Error fetching agents:", { message: error.message, stack: error.stack });
      res.status(500).json({ error: "Failed to fetch agents", details: error.message });
    }
  });

    router.get('/storage', async (req, res) => {
        try {
            const uploadDir = path.join(process.cwd(), "data", "characters");
            const files = await fs.promises.readdir(uploadDir);
            res.json({ files });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

router.get("/agents/:agentId", async (req, res) => {
    try {
        const session = await Session.getSession(req, res, { sessionRequired: true });
        const userId = session.getUserId();
        if (!userId) {
            elizaLogger.warn("No userId found in session for /agents/:agentId");
            return res.status(401).json({ error: "Unauthorized: No user ID found in session" });
        }
        const User = await sanityClient.fetch(
            `*[_type == "User" && userId == $userId][0]`,
            { userId }
        );
        if (!User) {
            elizaLogger.warn(`No User found for userId: ${userId}`);
            return res.status(404).json({ error: "User not found in Sanity" });
        }
        const { agentId } = validateUUIDParams(req.params, res) ?? { agentId: null };
        if (!agentId) return;
        const agent = agents.get(agentId);
        if (!agent) {
            res.status(404).json({ error: "Agent not found" });
            return;
        }
        // Check if the character belongs to the user
        const character = await sanityClient.fetch(
            `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
            { agentId, userRef: User._id }
        );
        if (!character) {
            elizaLogger.warn(`Character not found for agentId: ${agentId} and userRef: ${User._id}`);
            return res.status(403).json({ error: "Character not found or access denied" });
        }
        const characterData = agent.character;
        if (characterData?.settings?.secrets) {
            delete characterData.settings.secrets;
        }
        res.json({
            id: agent.agentId,
            character: characterData,
        });
    } catch (error) {
        elizaLogger.error("Error fetching agent:", { message: error.message, stack: error.stack });
        res.status(500).json({ error: "Failed to fetch agent", details: error.message });
    }
});

    router.delete("/agents/:agentId", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const agent: AgentRuntime = agents.get(agentId);

        if (agent) {
            agent.stop();
            directClient.unregisterAgent(agent);
            res.status(204).json({ success: true });
        } else {
            res.status(404).json({ error: "Agent not found" });
        }
    });


    router.post("/characters", async (req, res) => {
        try {
            const session = await Session.getSession(req, res, { sessionRequired: true });
            const userId = session.getUserId();
            if (!userId) {
                elizaLogger.warn("No userId found in session for character creation");
                return res.status(401).json({ error: "Unauthorized: No user ID found in session" });
            }
            const User = await sanityClient.fetch(
                `*[_type == "User" && userId == $userId][0]`,
                { userId }
            );
            if (!User) {
                elizaLogger.warn(`No User found for userId: ${userId}`);
                return res.status(404).json({ error: "User not found in Sanity" });
            }
            elizaLogger.debug(`Creating character for user:`, {
                _id: User._id,
                userId: User.userId,
                name: User.name,
            });
            const {
                id,
                name,
                username,
                system,
                bio,
                lore,
                messageExamples,
                postExamples,
                topics,
                adjectives,
                style,
                modelProvider,
                plugins,
                settings, // Do not provide a default here
                knowledge,
                enabled = true,
            } = req.body;
            if (!id || !name) {
                return res.status(400).json({ error: "id and name are required" });
            }
            if (!validateUuid(id)) {
                return res.status(400).json({
                    error: "Invalid id format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
                });
            }
            const existingId = await sanityClient.fetch(
                `*[_type == "character" && id == $id][0]`,
                { id }
            );
            if (existingId) {
                return res.status(400).json({ error: "Character ID already exists" });
            }
            const existingName = await sanityClient.fetch(
                `*[_type == "character" && name == $name][0]`,
                { name }
            );
            if (existingName) {
                return res.status(400).json({ error: "Character name already exists" });
            }
            if (username) {
                const existingUsername = await sanityClient.fetch(
                    `*[_type == "character" && username == $username][0]`,
                    { username }
                );
                if (existingUsername) {
                    return res.status(400).json({ error: "Username already exists" });
                }
            }
            const validModelProviders = ["OPENAI", "OLLAMA", "CUSTOM"];
            const validatedModelProvider = modelProvider && validModelProviders.includes(modelProvider)
                ? modelProvider
                : "OPENAI";
            // Ensure settings is fully populated
            const validatedSettings = settings || {
                secrets: { dynamic: [] },
                ragKnowledge: false,
                voice: { model: "default" }, // Add default voice or other settings as needed
                // Add other default settings fields expected by Overview
            };
            const characterDoc = {
                _type: "character",
                id,
                name,
                username: username || undefined,
                system: system || "",
                bio: bio || [],
                lore: lore || [],
                messageExamples: messageExamples || [],
                postExamples: postExamples || [],
                topics: topics || [],
                adjectives: adjectives || [],
                style: style || { all: [], chat: [], post: [] },
                modelProvider: validatedModelProvider,
                plugins: plugins || [],
                settings: validatedSettings,
                knowledge: knowledge || [],
                enabled,
                createdBy: {
                    _type: "reference",
                    _ref: User._id,
                },
            };
            const createdCharacter = await sanityClient.create(characterDoc);
            elizaLogger.debug(`Character created:`, {
                _id: createdCharacter._id,
                id: createdCharacter.id,
                name: createdCharacter.name,
                createdBy: createdCharacter.createdBy,
            });
            try {
                const character: Character = {
                    id,
                    name,
                    username: username || undefined,
                    system: system || "",
                    bio: bio || [],
                    lore: lore || [],
                    messageExamples: messageExamples || [],
                    postExamples: postExamples || [],
                    topics: topics || [],
                    adjectives: adjectives || [],
                    style: style || { all: [], chat: [], post: [] },
                    modelProvider: validatedModelProvider.toLowerCase() as any,
                    plugins: plugins || [],
                    settings: validatedSettings, // Use validated settings
                    knowledge: knowledge || [],
                    createdBy: { _ref: User._id },
                };
                await directClient.startAgent(character);
                elizaLogger.debug(`${name} agent started`);
            } catch (error) {
                elizaLogger.error(`Failed to start agent: ${error.message}`);
            }
            res.json({ character: createdCharacter });
        } catch (error) {
            elizaLogger.error("Error creating character:", { message: error.message, stack: error.stack });
            res.status(500).json({ error: "Failed to create character", details: error.message });
        }
    });
// Edit Characters
router.patch("/characters/:characterId", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { characterId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    // Validate that the character exists and belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`Character not found for characterId: ${characterId} and userRef: ${User._id}`);
      return res.status(404).json({ error: "Character not found or access denied" });
    }

    const {
      name,
      username,
      system,
      bio,
      lore,
      messageExamples,
      postExamples,
      topics,
      adjectives,
      style,
      modelProvider,
      plugins,
      settings,
      knowledge,
      enabled,
    } = req.body;

    // Validate input (at least one field required)
    if (
      !name &&
      !username &&
      !system &&
      !bio &&
      !lore &&
      !messageExamples &&
      !postExamples &&
      !topics &&
      !adjectives &&
      !style &&
      !modelProvider &&
      !plugins &&
      !settings &&
      !knowledge &&
      enabled === undefined
    ) {
      return res.status(400).json({ error: "At least one field is required to update" });
    }

    // Validate unique name and username if provided
    if (name && name !== character.name) {
      const existingName = await sanityClient.fetch(
        `*[_type == "character" && name == $name && id != $characterId][0]`,
        { name, characterId }
      );
      if (existingName) {
        return res.status(400).json({ error: "Character name already exists" });
      }
    }
    if (username && username !== character.username) {
      const existingUsername = await sanityClient.fetch(
        `*[_type == "character" && username == $username && id != $characterId][0]`,
        { username, characterId }
      );
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    // Validate modelProvider
    const validModelProviders = ["OPENAI", "OLLAMA", "CUSTOM"];
    const validatedModelProvider =
      modelProvider && validModelProviders.includes(modelProvider)
        ? modelProvider
        : character.modelProvider;

    // Prepare update object
    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (username) updateFields.username = username;
    if (system) updateFields.system = system;
    if (bio) updateFields.bio = bio;
    if (lore) updateFields.lore = lore;
    if (messageExamples) updateFields.messageExamples = messageExamples;
    if (postExamples) updateFields.postExamples = postExamples;
    if (topics) updateFields.topics = topics;
    if (adjectives) updateFields.adjectives = adjectives;
    if (style) updateFields.style = style;
    if (modelProvider) updateFields.modelProvider = validatedModelProvider;
    if (plugins) updateFields.plugins = plugins;
    if (settings) updateFields.settings = settings;
    if (knowledge) updateFields.knowledge = knowledge;
    if (enabled !== undefined) updateFields.enabled = enabled;
    updateFields.updatedAt = new Date().toISOString();

    // Update character in Sanity
    const updatedCharacter = await sanityClient
      .patch(character._id)
      .set(updateFields)
      .commit();

    elizaLogger.debug(`Updated character: characterId=${characterId}, name=${updatedCharacter.name}`);

    // Restart the agent with updated character data
    try {
      const agent = agents.get(characterId);
      if (agent) {
        agent.stop();
        directClient.unregisterAgent(agent);
      }
      const characterData: Character = {
        id: characterId,
        name: updatedCharacter.name,
        username: updatedCharacter.username,
        system: updatedCharacter.system || "",
        bio: updatedCharacter.bio || [],
        lore: updatedCharacter.lore || [],
        messageExamples: updatedCharacter.messageExamples || [],
        postExamples: updatedCharacter.postExamples || [],
        topics: updatedCharacter.topics || [],
        adjectives: updatedCharacter.adjectives || [],
        style: updatedCharacter.style || { all: [], chat: [], post: [] },
        modelProvider: validatedModelProvider.toLowerCase() as any,
        plugins: updatedCharacter.plugins || [],
        settings: updatedCharacter.settings || {
          secrets: { dynamic: [] },
          ragKnowledge: false,
          voice: { model: "default" },
        },
        knowledge: updatedCharacter.knowledge || [],
        createdBy: { _ref: User._id },
      };
      await directClient.startAgent(characterData);
      elizaLogger.debug(`Agent restarted for characterId=${characterId}`);
    } catch (error) {
      elizaLogger.error(`Failed to restart agent: ${error.message}`);
    }

    res.json({ character: updatedCharacter });
  } catch (error) {
    elizaLogger.error("Error updating character:", error);
    res.status(500).json({ error: "Failed to update character", details: error.message });
  }
});


// Delete Character
router.delete("/characters/:characterId", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { characterId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    // Validate that the character exists and belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`Character not found for characterId: ${characterId} and userRef: ${User._id}`);
      return res.status(404).json({ error: "Character not found or access denied" });
    }

    // Delete associated knowledge items
    const knowledgeItems = await sanityClient.fetch(
      `*[_type == "knowledge" && agentId == $characterId]`,
      { characterId }
    );
    for (const knowledge of knowledgeItems) {
      await sanityClient.delete(knowledge._id);
      elizaLogger.debug(`Deleted knowledge item: knowledgeId=${knowledge.id}, characterId=${characterId}`);
    }

    // Delete character from Sanity
    await sanityClient.delete(character._id);
    elizaLogger.debug(`Deleted character: characterId=${characterId}, name=${character.name}`);

    // Stop and unregister the agent
    const agent = agents.get(characterId);
    if (agent) {
      agent.stop();
      directClient.unregisterAgent(agent);
      elizaLogger.debug(`Agent stopped and unregistered for characterId=${characterId}`);
    }

    res.status(204).end();
  } catch (error) {
    elizaLogger.error("Error deleting character:", error);
    res.status(500).json({ error: "Failed to delete character", details: error.message });
  }
});

    // character Knowledge
    // GET /agents/:agentId/knowledge
router.get("/agents/:agentId/knowledge", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { agentId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    // Validate that the character belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "Character not found or access denied" });
    }

    // Fetch knowledge items for this agent
    const knowledgeItems = await sanityClient.fetch(
      `*[_type == "knowledge" && agentId == $agentId]`,
      { agentId }
    );
    res.json({ knowledge: knowledgeItems });
  } catch (error) {
    elizaLogger.error("Error fetching knowledge:", error);
    res.status(500).json({ error: "Failed to fetch knowledge" });
  }
});

// POST /agents/:agentId/knowledge
router.post("/agents/:agentId/knowledge", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { agentId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    // Validate character ownership and ragKnowledge setting
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]{settings}`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "Character not found or access denied" });
    }
    if (!character.settings?.ragKnowledge) {
      return res.status(403).json({ error: "Knowledge feature is not enabled for this character" });
    }

    const { name, text, metadata } = req.body;
    if (!name || !text) {
      return res.status(400).json({ error: "Name and text are required" });
    }

    // Create knowledge document
    const knowledgeId = uuidv4();
    const knowledgeDoc = {
      _type: "knowledge",
      id: knowledgeId,
      name,
      agentId,
      text,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };
    const createdKnowledge = await sanityClient.create(knowledgeDoc);

    res.json({ knowledge: createdKnowledge });
  } catch (error) {
    elizaLogger.error("Error creating knowledge:", error);
    res.status(500).json({ error: "Failed to create knowledge" });
  }
});

// PATCH /agents/:agentId/knowledge/:knowledgeId
router.patch("/agents/:agentId/knowledge/:knowledgeId", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { agentId, knowledgeId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    // Validate character ownership and ragKnowledge setting
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]{settings}`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "Character not found or access denied" });
    }
    if (!character.settings?.ragKnowledge) {
      return res.status(403).json({ error: "Knowledge feature is not enabled for this character" });
    }

    // Validate knowledge item exists and belongs to the agent
    const knowledge = await sanityClient.fetch(
      `*[_type == "knowledge" && id == $knowledgeId && agentId == $agentId][0]`,
      { knowledgeId, agentId }
    );
    if (!knowledge) {
      elizaLogger.warn(`Knowledge not found for knowledgeId: ${knowledgeId} and agentId: ${agentId}`);
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    const { name, text, metadata } = req.body;
    if (!name && !text && !metadata) {
      return res.status(400).json({ error: "At least one field (name, text, or metadata) is required" });
    }

    // Update knowledge document
    const updatedKnowledge = await sanityClient
      .patch(knowledge._id)
      .set({
        ...(name && { name }),
        ...(text && { text }),
        ...(metadata && { metadata }),
        updatedAt: new Date().toISOString(),
      })
      .commit();

    elizaLogger.debug(`Updated knowledge item: knowledgeId=${knowledgeId}, agentId=${agentId}`);
    res.json({ knowledge: updatedKnowledge });
  } catch (error) {
    elizaLogger.error("Error updating knowledge:", error);
    res.status(500).json({ error: "Failed to update knowledge" });
  }
});

// DELETE /agents/:agentId/knowledge/:knowledgeId
router.delete("/agents/:agentId/knowledge/:knowledgeId", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { agentId, knowledgeId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    // Validate character ownership and ragKnowledge setting
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]{settings}`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "Character not found or access denied" });
    }
    if (!character.settings?.ragKnowledge) {
      return res.status(403).json({ error: "Knowledge feature is not enabled for this character" });
    }

    // Validate knowledge item exists and belongs to the agent
    const knowledge = await sanityClient.fetch(
      `*[_type == "knowledge" && id == $knowledgeId && agentId == $agentId][0]`,
      { knowledgeId, agentId }
    );
    if (!knowledge) {
      elizaLogger.warn(`Knowledge not found for knowledgeId: ${knowledgeId} and agentId: ${agentId}`);
      return res.status(404).json({ error: "Knowledge item not found" });
    }

    // Delete knowledge document
    await sanityClient.delete(knowledge._id);
    elizaLogger.debug(`Deleted knowledge item: knowledgeId=${knowledgeId}, agentId=${agentId}`);
    res.status(204).json({ success: true });
  } catch (error) {
    elizaLogger.error("Error deleting knowledge:", error);
    res.status(500).json({ error: "Failed to delete knowledge" });
  }
});

  // WaitlistCheck route
  router.get("/user/check", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== "string") {
        return res.status(400).json({ error: "userId is required" });
      }
  
      const User = await sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]`,
        { userId }
      );
  
      if (User) {
        return res.json({ exists: true, User });
      }
      return res.json({ exists: false });
    } catch (error) {
      elizaLogger.error("Error checking user:", error);
      res.status(500).json({ error: "Failed to check user", details: error.message });
    }
  });

  
      // User routes
      router.post("/user", async (req, res) => {
        elizaLogger.debug("Handling /user POST request");
        elizaLogger.debug("Request body:", req.body);
        try {
          const session = await Session.getSession(req, res, { sessionRequired: true });
          const userId = session.getUserId();
          const { name, email, interest, referralSource, createdAt, userType } = req.body;
      
          if (!name || !email || !interest || !referralSource) {
            return res.status(400).json({ error: "Missing required fields" });
          }
      
          const trialStartDate = new Date();
          const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
          let existingUser = null;
          const maxRetries = 3;
          for (let i = 0; i < maxRetries; i++) {
            try {
              existingUser = await sanityClient.fetch(
                `*[_type == "User" && userId == $userId][0]`,
                { userId }
              );
              break;
            } catch (err) {
              if (i === maxRetries - 1) {
                elizaLogger.error("Failed to fetch user after retries:", err);
                throw err;
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
      
          if (existingUser) {
            elizaLogger.debug(`User already exists for userId: ${userId}`);
            return res.status(200).json({
              user: {
                userId: existingUser.userId,
                userType: existingUser.userType || "email",
                email: existingUser.email,
                name: existingUser.name,
                trialStartDate: existingUser.trialStartDate,
                trialEndDate: existingUser.trialEndDate,
                subscriptionStatus: existingUser.subscriptionStatus || "none",
              }
            });
          }
      
          const User = await sanityClient.create({
            _type: "User",
            name,
            email,
            interest,
            referralSource,
            userId,
            createdAt: createdAt || new Date().toISOString(),
            userType: userType || "email",
            trialStartDate: trialStartDate.toISOString(),
            trialEndDate: trialEndDate.toISOString(),
            subscriptionStatus: "none",
          });
      
          elizaLogger.debug("Created User:", User);
          res.json({
            user: {
              userId: User.userId,
              userType: User.userType || "email",
              email: User.email,
              name: User.name,
              trialStartDate: User.trialStartDate,
              trialEndDate: User.trialEndDate,
              subscriptionStatus: User.subscriptionStatus,
            }
          });
        } catch (error: any) {
          elizaLogger.error("Error creating user:", error);
          res.status(500).json({ error: "Failed to create user", details: error.message });
        }
      });

      router.get("/user", async (req, res) => {
        try {
          const session = await Session.getSession(req, res, { sessionRequired: true });
          const userId = session.getUserId();
      
          let user = null;
          const maxRetries = 3;
          for (let i = 0; i < maxRetries; i++) {
            try {
              user = await sanityClient.fetch(
                `*[_type == "User" && userId == $userId][0]`,
                { userId }
              );
              break;
            } catch (err) {
              if (i === maxRetries - 1) {
                elizaLogger.error("Failed to fetch user after retries:", err);
                throw err;
              }
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
      
          if (!user) {
            elizaLogger.warn(`User not found for userId=${userId}`);
            return res.status(404).json({ error: "User not found" });
          }
      
          elizaLogger.debug(`Fetched user data for userId=${userId}`);
          res.json({
            user: {
              userId: user.userId,
              userType: user.userType || "email",
              email: user.email,
              name: user.name,
              trialStartDate: user.trialStartDate,
              trialEndDate: user.trialEndDate,
              subscriptionStatus: user.subscriptionStatus || "none",
            }
          });
        } catch (error: any) {
          elizaLogger.error("Error in /user endpoint:", error);
          res.status(error.status || 500).json({ error: error.message || "Failed to fetch user data" });
        }
      });

// Google OAuth callback
// Google OAuth callback
router.get("/auth/callback/google", async (req, res) => {
  elizaLogger.debug("Handling /auth/callback/google GET request");
  try {
    const session = await Session.getSession(req, res, { sessionRequired: false });
    const userId = session?.getUserId();

    if (!userId) {
      elizaLogger.error("No session found in Google OAuth callback");
      return res.status(401).json({ error: "No session found" });
    }

    // Fetch user info from SuperTokens
    const userInfo = await SuperTokens.getUserById(userId);
    if (!userInfo) {
      elizaLogger.error("User not found in SuperTokens");
      return res.status(404).json({ error: "User not found in SuperTokens" });
    }

    const email = userInfo.emails?.[0];
    const name =
      userInfo.loginMethods.find((lm) => lm.thirdParty?.thirdPartyId === "google")?.thirdParty?.userInfo?.name ||
      "Google User";

    const existingUser = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    res.redirect("http://localhost:5173/home");
  } catch (error) {
    elizaLogger.error("Error in Google OAuth callback:", error);
    res.status(500).json({ error: "Failed to process Google OAuth callback", details: error.message });
  }
});

router.get("/items", async (req, res) => {
  try {
    const { itemType } = req.query;
    const items: Item[] = [];

    // 1. Fetch items from Sanity
    try {
      const query = itemType
        ? `*[_type == "Item" && itemType == $itemType]{id, name, description, price, itemType, features, isPopular, trialInfo, useCase}`
        : `*[_type == "Item"]{id, name, description, price, itemType, features, isPopular, trialInfo, useCase}`;
      const sanityItems = await sanityClient.fetch(query, { itemType });
      items.push(
        ...sanityItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          itemType: item.itemType,
          features: item.features || [], // Ensure features is an array, even if undefined
          isPopular: item.isPopular || false, // Default to false if undefined
          trialInfo: item.trialInfo || undefined, // Optional field
          useCase: item.useCase || undefined, // Optional field
          source: "sanity",
        }))
      );
      elizaLogger.debug(`Fetched ${sanityItems.length} items from Sanity`, { itemType });
    } catch (error) {
      elizaLogger.error("Error fetching items from Sanity:", error);
    }

    // 2. Fetch items from a microservice (simulated)
    // try {
    //   const microserviceUrl = "https://api.example.com/items"; // Replace with your microservice URL
    //   const response = await fetch(microserviceUrl);
    //   if (response.ok) {
    //     const microserviceItems = await response.json();
    //     items.push(
    //       ...microserviceItems.map((item: any) => ({
    //         id: item.id,
    //         name: item.name,
    //         description: item.description,
    //         price: item.price,
    //         itemType: item.itemType,
    //         features: item.features || [], // Add support for new fields
    //         isPopular: item.isPopular || false,
    //         trialInfo: item.trialInfo || undefined,
    //         useCase: item.useCase || undefined,
    //         source: "microservice1",
    //       }))
    //     );
    //     elizaLogger.debug(`Fetched ${microserviceItems.length} items from microservice`);
    //   } else {
    //     elizaLogger.warn("Microservice fetch failed:", response.statusText);
    //   }
    // } catch (error) {
    //   elizaLogger.error("Error fetching items from microservice:", error);
    // }

    // 3. Add static fallback items
    const staticItems: Item[] = [
      {
        id: "static-1",
        name: "Basic Plan",
        description: "A basic subscription plan for ElizaOS.",
        price: 500, // $5.00
        itemType: "subscription",
        features: [
          "1 AI character",
          "100 conversations/month",
          "Basic RAG knowledge",
          "Sanity CMS access",
        ],
        isPopular: false,
        trialInfo: "7-day free trial",
        useCase: "Best for individuals",
        source: "static",
      },
      {
        id: "static-2",
        name: "Premium Plan",
        description: "A premium subscription plan for ElizaOS.",
        price: 1500, // $15.00
        itemType: "subscription",
        features: [
          "5 AI characters",
          "1000 conversations/month",
          "Advanced RAG knowledge",
          "Priority support",
        ],
        isPopular: true,
        trialInfo: "30-day money-back guarantee",
        useCase: "Best for teams",
        source: "static",
      },
    ];
    items.push(...staticItems);
    elizaLogger.debug(`Added ${staticItems.length} static items`);

    // Remove duplicates (if any) based on id
    const uniqueItems = Array.from(
      new Map(items.map((item) => [item.id, item])).values()
    );

    res.json({ items: uniqueItems });
  } catch (error: any) {
    elizaLogger.error("Error in /items endpoint:", error);
    res.status(500).json({ error: "Failed to fetch items", details: error.message });
  }
});

    router.post("/agents/:agentId/set", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        let agent: AgentRuntime = agents.get(agentId);

        // update character
        if (agent) {
            // stop agent
            agent.stop();
            directClient.unregisterAgent(agent);
            // if it has a different name, the agentId will change
        }

        // stores the json data before it is modified with added data
        const characterJson = { ...req.body };

        // load character from body
        const character = req.body;
        try {
            validateCharacterConfig(character);
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                success: false,
                message: e.message,
            });
            return;
        }

        // start it up (and register it)
        try {
            agent = await directClient.startAgent(character);
            elizaLogger.log(`${character.name} started`);
        } catch (e) {
            elizaLogger.error(`Error starting agent: ${e}`);
            res.status(500).json({
                success: false,
                message: e.message,
            });
            return;
        }

        if (process.env.USE_CHARACTER_STORAGE === "true") {
            try {
                const filename = `${agent.agentId}.json`;
                const uploadDir = path.join(
                    process.cwd(),
                    "data",
                    "characters"
                );
                const filepath = path.join(uploadDir, filename);
                await fs.promises.mkdir(uploadDir, { recursive: true });
                await fs.promises.writeFile(
                    filepath,
                    JSON.stringify(
                        { ...characterJson, id: agent.agentId },
                        null,
                        2
                    )
                );
                elizaLogger.debug(
                    `Character stored successfully at ${filepath}`
                );
            } catch (error) {
                elizaLogger.error(
                    `Failed to store character: ${error.message}`
                );
            }
        }

        res.json({
            id: character.id,
            character: character,
        });
    });

    // router.get("/agents/:agentId/channels", async (req, res) => {
    //     const { agentId } = validateUUIDParams(req.params, res) ?? {
    //         agentId: null,
    //     };
    //     if (!agentId) return;

    //     const runtime = agents.get(agentId);

    //     if (!runtime) {
    //         res.status(404).json({ error: "Runtime not found" });
    //         return;
    //     }

    //     const API_TOKEN = runtime.getSetting("DISCORD_API_TOKEN") as string;
    //     const rest = new REST({ version: "10" }).setToken(API_TOKEN);

    //     try {
    //         const guilds = (await rest.get(Routes.userGuilds())) as Array<any>;

    //         res.json({
    //             id: runtime.agentId,
    //             guilds: guilds,
    //             serverCount: guilds.length,
    //         });
    //     } catch (error) {
    //         console.error("Error fetching guilds:", error);
    //         res.status(500).json({ error: "Failed to fetch guilds" });
    //     }
    // });

    router.get("/agents/:agentId/:roomId/memories", async (req, res) => {
        const { agentId, roomId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
            roomId: null,
        };
        if (!agentId || !roomId) return;

        let runtime = agents.get(agentId);

        // if runtime is null, look for runtime with the same name
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            res.status(404).send("Agent not found");
            return;
        }

        try {
            const memories = await runtime.messageManager.getMemories({
                roomId,
            });
            const response = {
                agentId,
                roomId,
                memories: memories.map((memory) => ({
                    id: memory.id,
                    userId: memory.userId,
                    agentId: memory.agentId,
                    createdAt: memory.createdAt,
                    content: {
                        text: memory.content.text,
                        action: memory.content.action,
                        source: memory.content.source,
                        url: memory.content.url,
                        inReplyTo: memory.content.inReplyTo,
                        attachments: memory.content.attachments?.map(
                            (attachment) => ({
                                id: attachment.id,
                                url: attachment.url,
                                title: attachment.title,
                                source: attachment.source,
                                description: attachment.description,
                                text: attachment.text,
                                contentType: attachment.contentType,
                            })
                        ),
                    },
                    embedding: memory.embedding,
                    roomId: memory.roomId,
                    unique: memory.unique,
                    similarity: memory.similarity,
                })),
            };

            res.json(response);
        } catch (error) {
            console.error("Error fetching memories:", error);
            res.status(500).json({ error: "Failed to fetch memories" });
        }
    });

    // router.get("/tee/agents", async (req, res) => {
    //     try {
    //         const allAgents = [];

    //         for (const agentRuntime of agents.values()) {
    //             const teeLogService = agentRuntime
    //                 .getService<TeeLogService>(ServiceType.TEE_LOG)
    //                 .getInstance();

    //             const agents = await teeLogService.getAllAgents();
    //             allAgents.push(...agents);
    //         }

    //         const runtime: AgentRuntime = agents.values().next().value;
    //         const teeLogService = runtime
    //             .getService<TeeLogService>(ServiceType.TEE_LOG)
    //             .getInstance();
    //         const attestation = await teeLogService.generateAttestation(
    //             JSON.stringify(allAgents)
    //         );
    //         res.json({ agents: allAgents, attestation: attestation });
    //     } catch (error) {
    //         elizaLogger.error("Failed to get TEE agents:", error);
    //         res.status(500).json({
    //             error: "Failed to get TEE agents",
    //         });
    //     }
    // });

    // router.get("/tee/agents/:agentId", async (req, res) => {
    //     try {
    //         const agentId = req.params.agentId;
    //         const agentRuntime = agents.get(agentId);
    //         if (!agentRuntime) {
    //             res.status(404).json({ error: "Agent not found" });
    //             return;
    //         }

    //         const teeLogService = agentRuntime
    //             .getService<TeeLogService>(ServiceType.TEE_LOG)
    //             .getInstance();

    //         const teeAgent = await teeLogService.getAgent(agentId);
    //         const attestation = await teeLogService.generateAttestation(
    //             JSON.stringify(teeAgent)
    //         );
    //         res.json({ agent: teeAgent, attestation: attestation });
    //     } catch (error) {
    //         elizaLogger.error("Failed to get TEE agent:", error);
    //         res.status(500).json({
    //             error: "Failed to get TEE agent",
    //         });
    //     }
    // });

    // router.post(
    //     "/tee/logs",
    //     async (req: express.Request, res: express.Response) => {
    //         try {
    //             const query = req.body.query || {};
    //             const page = Number.parseInt(req.body.page) || 1;
    //             const pageSize = Number.parseInt(req.body.pageSize) || 10;

    //             const teeLogQuery: TeeLogQuery = {
    //                 agentId: query.agentId || "",
    //                 roomId: query.roomId || "",
    //                 userId: query.userId || "",
    //                 type: query.type || "",
    //                 containsContent: query.containsContent || "",
    //                 startTimestamp: query.startTimestamp || undefined,
    //                 endTimestamp: query.endTimestamp || undefined,
    //             };
    //             const agentRuntime: AgentRuntime = agents.values().next().value;
    //             const teeLogService = agentRuntime
    //                 .getService<TeeLogService>(ServiceType.TEE_LOG)
    //                 .getInstance();
    //             const pageQuery = await teeLogService.getLogs(
    //                 teeLogQuery,
    //                 page,
    //                 pageSize
    //             );
    //             const attestation = await teeLogService.generateAttestation(
    //                 JSON.stringify(pageQuery)
    //             );
    //             res.json({
    //                 logs: pageQuery,
    //                 attestation: attestation,
    //             });
    //         } catch (error) {
    //             elizaLogger.error("Failed to get TEE logs:", error);
    //             res.status(500).json({
    //                 error: "Failed to get TEE logs",
    //             });
    //         }
    //     }
    // );

    router.post("/agent/start", async (req, res) => {
        const { characterPath, characterJson } = req.body;
        console.log("characterPath:", characterPath);
        console.log("characterJson:", characterJson);
        try {
            let character: Character;
            if (characterJson) {
                character = await directClient.jsonToCharacter(
                    characterPath,
                    characterJson
                );
            } else if (characterPath) {
                character =
                    await directClient.loadCharacterTryPath(characterPath);
            } else {
                throw new Error("No character path or JSON provided");
            }
            await directClient.startAgent(character);
            elizaLogger.log(`${character.name} started`);

            res.json({
                id: character.id,
                character: character,
            });
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });

    router.post("/agents/:agentId/stop", async (req, res) => {
        const agentId = req.params.agentId;
        console.log("agentId", agentId);
        const agent: AgentRuntime = agents.get(agentId);

        // update character
        if (agent) {
            // stop agent
            agent.stop();
            directClient.unregisterAgent(agent);
            // if it has a different name, the agentId will change
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Agent not found" });
        }
    });
     // Add SuperTokens error handler
  router.use(errorHandler());

  // Custom error handler
  router.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    elizaLogger.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  });





  router.get("/landing-page", async (req, res) => {
    try {
      // Query the landingPage document from Sanity
      const query = `*[_type == "landingPage"][0] {
        title,
        slug,
        heroSection {
          title,
          subtitle,
          primaryCtaText,
          secondaryCtaText,
          trustSignal,
          backgroundImage {
            asset-> {
              _id,
              url
            }
          },
          mascotModel {
      asset-> {
        _id,
        url
      }
    }
        },
        featuresSection {
          heading,
          features[] {
            title,
            description,
            icon {
              asset-> {
                _id,
                url
              }
            }
          },
          ctaText
        },
        benefitsSection {
          heading,
          description,
          benefitsList,
          image {
            asset-> {
              _id,
              url
            }
          }
        },
        testimonialsSection {
          heading,
          testimonials[] {
            quote,
            author,
            role
          },
          trustSignal
        },
        ctaSection {
          heading,
          description,
          ctaText
        },
        footerSection {
          tagline,
          companyLinks[] { label, url },
          productLinks[] { label, url },
          legalLinks[] { label, url }
        },
        subFooterSection {
          ctaText,
          ctaUrl,
          copyright
        }
      }`;
  
      const landingPage = await sanityClient.fetch(query);
  
      if (!landingPage) {
        elizaLogger.warn("No landing page found in Sanity");
        return res.status(404).json({ error: "Landing page not found" });
      }
  
      // Use urlFor to generate proper image URLs
      const formattedLandingPage = {
        ...landingPage,
        heroSection: {
          ...landingPage.heroSection,
          backgroundImage: landingPage.heroSection.backgroundImage
            ? urlFor(landingPage.heroSection.backgroundImage).url()
            : null,
        },
        featuresSection: {
          ...landingPage.featuresSection,
          features: landingPage.featuresSection.features.map((feature: any) => ({
            ...feature,
            icon: feature.icon ? urlFor(feature.icon).url() : null,
          })),
        },
        benefitsSection: {
          ...landingPage.benefitsSection,
          image: landingPage.benefitsSection.image
            ? urlFor(landingPage.benefitsSection.image).url()
            : null,
        },
      };
  
      elizaLogger.debug("Fetched landing page from Sanity", {
        title: landingPage.title,
      });
  
      res.json({ landingPage: formattedLandingPage });
    } catch (error: any) {
      elizaLogger.error("Error fetching landing page:", error);
      res.status(500).json({ error: "Failed to fetch landing page", details: error.message });
    }
  });

    return router;
}