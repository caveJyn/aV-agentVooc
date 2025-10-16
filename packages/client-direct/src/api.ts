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
    stringToUuid,
    ensureKeys,
    type Plugin,
      type RAGKnowledgeItem,
      embed,
      type Secret,
      Content,
      Memory
} from "@elizaos/core";

// import type { TeeLogQuery, TeeLogService } from "@elizaos/plugin-tee-log";
// import { REST, Routes } from "discord.js";
import type { DirectClient } from ".";
import { validateUuid } from "@elizaos/core";
import { sanityClient, urlFor } from "@elizaos-plugins/plugin-sanity";
import Session from "supertokens-node/recipe/session";
import Stripe from "stripe";
// import fetch from "node-fetch"; // Add this import for microservice requests
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import type { EmailClient } from "@elizaos-plugins/plugin-email";
import { computeHash, encryptValue, decryptValue } from './utils/cryptoUtils';
import { randomUUID, sign } from 'crypto';
import axios from 'axios';
import { requireAuth, AuthRequest, requireActiveSubscription } from "./lib/middleware";
import { Webhook } from "svix";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "your-secret-key", {
  apiVersion: "2025-06-30.basil",
});





















// Define the Item interface
interface Item {
    id: string;
    name: string;
    description: string;
    price: number; // Price in cents (e.g., 1000 = $10.00)
    itemType?: string; // Optional, set for Sanity items, undefined for others
    pluginName?: string; // Added for plugin items
  stripePriceId?: string; // Added for base items
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
  
// Add this function for deactivation
async function deactivateUser(sanityUserId: string) {
  const transaction = sanityClient.transaction();

  // Update user
  transaction.patch(sanityUserId, {
    set: {
      subscriptionStatus: "inactive",
      activePriceIds: [],
      activePlugins: [],
    },
  });

  // Deactivate characters
  const characters = await sanityClient.fetch(
    `*[_type == "character" && createdBy._ref == $userId]`,
    { userId: sanityUserId }
  );

  for (const char of characters) {
    transaction.patch(char._id, {
      set: {
        enabled: false,
        plugins: [],
      },
    });
  }

  await transaction.commit();
  elizaLogger.info("[DEACTIVATE] User and characters deactivated", { userId: sanityUserId });
}
  
























export function createApiRouter(
    agents: Map<string, IAgentRuntime>,
    directClient: DirectClient
):Router {
    const router = express.Router();


    // Debug middleware to log requests
    router.use((req, res, next) => {
        elizaLogger.debug(`[CLIENT-DIRECT] Request received: ${req.method} ${req.originalUrl}`);
        next();
    });


    router.get("/", (req, res) => {
        res.send("Welcome, this is the REST API!");
    });
    

    router.get("/hello", (req, res) => {
        res.json({ message: "Hello World!" });
    });






































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// -------------------Stripe Subscription Management API Endpoints-------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// 1. Start a trial for a user, initiating a subscription with a trial period
// POST /start-trial
// Initiates a trial subscription for a user with a default base plan, creating a Stripe customer if needed
  router.post("/start-trial", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] User not found for userId=${userId}`);
      return res.status(404).json({ error: "User not found" });
    }

    if (user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing") {
      elizaLogger.warn(`[CLIENT-DIRECT] User ${userId} already has an active subscription`);
      return res.status(400).json({ error: "User already has an active subscription" });
    }

    // Select default base plan (e.g., lowest-priced base plan)
    const defaultBaseItem = await sanityClient.fetch(
      `*[_type == "Item" && itemType == "base"] | order(price asc)[0]`,
      {}
    );
    if (!defaultBaseItem || !defaultBaseItem.stripePriceId) {
      elizaLogger.error("[CLIENT-DIRECT] No default base plan found");
      return res.status(500).json({ error: "No default base plan configured" });
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await sanityClient.patch(user._id).set({ stripeCustomerId }).commit();
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: defaultBaseItem.stripePriceId }],
      trial_period_days: 7,
      payment_behavior: "default_incomplete", // Allow subscription without payment method
      metadata: { userId },
    });

    const trialStartDate = subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : new Date().toISOString();
    const trialEndDate = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await sanityClient.patch(user._id).set({
      subscriptionStatus: subscription.status,
      stripeSubscriptionId: subscription.id,
      trialStartDate,
      trialEndDate,
      hasUsedTrial: true,
      activePriceIds: [defaultBaseItem.stripePriceId],
      activePlugins: [],
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    }).commit();

    elizaLogger.debug("[CLIENT-DIRECT] Started trial for user", {
      userId,
      subscriptionId: subscription.id,
      trialEndDate,
    });

    res.json({ success: true, subscriptionId: subscription.id });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /start-trial:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to start trial", details: error.message });
  }
});



// 2. Create a checkout session to start a subscription
// POST /checkout-session
// Creates a Stripe Checkout Session for a new subscription, validating items and handling trial eligibility
router.post("/checkout-session", checkoutLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      elizaLogger.error("[CLIENT-DIRECT] STRIPE_SECRET_KEY is not set in environment variables");
      return res.status(500).json({ error: "Server configuration error: Missing Stripe secret key" });
    }

    if (!process.env.WEBSITE_DOMAIN) {
      elizaLogger.error("[CLIENT-DIRECT] WEBSITE_DOMAIN is not set in environment variables");
      return res.status(500).json({ error: "Server configuration error: Missing WEBSITE_DOMAIN" });
    }

    const websiteDomain = process.env.WEBSITE_DOMAIN;
    const isValidUrl = (url) => {
      try {
        new URL(url);
        return url.startsWith("http://") || url.startsWith("https://");
      } catch {
        return false;
      }
    };

    if (!isValidUrl(websiteDomain)) {
      elizaLogger.error("[CLIENT-DIRECT] Invalid WEBSITE_DOMAIN", { websiteDomain });
      return res.status(500).json({ error: "Server configuration error: Invalid WEBSITE_DOMAIN" });
    }

    const userId = req.userId; // Sanity UUID from requireAuth middleware
    const { items } = req.body;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] Missing userId from middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      elizaLogger.warn("[CLIENT-DIRECT] No items provided in /checkout-session request");
      return res.status(400).json({ error: "At least one item is required" });
    }

    const baseItems = items.filter((item) => item.itemType === "base");
    const pluginItems = items.filter((item) => item.itemType === "plugin");

    if (baseItems.length !== 1) {
      elizaLogger.warn("[CLIENT-DIRECT] Invalid number of base subscriptions", { count: baseItems.length });
      return res.status(400).json({ error: "Exactly one base subscription is required" });
    }

    const maxRetries = 3;
    let user;
    for (let i = 0; i < maxRetries; i++) {
      try {
        user = await sanityClient.fetch(
          `*[_type == "User" && userId == $userId][0]`,
          { userId }
        );
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to fetch user after retries", {
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
      elizaLogger.warn("[CLIENT-DIRECT] No User found in Sanity", { userId });
      return res.status(404).json({ error: "User not found in database" });
    }

    const hasActiveSubscription = user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";

    if (hasActiveSubscription) {
      elizaLogger.warn("[CLIENT-DIRECT] User already has an active subscription", {
        userId,
        subscriptionId: user.stripeSubscriptionId,
        subscriptionStatus: user.subscriptionStatus,
      });
      return res.status(400).json({
        error: "User already has an active subscription",
        subscriptionId: user.stripeSubscriptionId,
        subscriptionStatus: user.subscriptionStatus,
      });
    }

    let sanityItems;
    try {
      sanityItems = await sanityClient.fetch(`*[_type == "Item"]`);
    } catch (error) {
      elizaLogger.error("[CLIENT-DIRECT] Failed to fetch Sanity items", {
        userId,
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: "Server error: Failed to fetch subscription items" });
    }

    const validatedItems = [];
    const subscriptionItems = [];
    const activePlugins = [];

    for (const item of [...baseItems, ...pluginItems]) {
      const sanityItem = sanityItems.find((si) => si.id === item.id);

      if (sanityItem && sanityItem.price === item.price && sanityItem.itemType === item.itemType) {
        validatedItems.push(sanityItem);
        subscriptionItems.push({ id: sanityItem.id, price: sanityItem.price });

        if (sanityItem.itemType === "plugin" && sanityItem.pluginName) {
          activePlugins.push(sanityItem.pluginName);
        }
        continue;
      }

      if (item.source === "static" && (item.itemType === "base" || item.itemType === "plugin")) {
        validatedItems.push({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          itemType: item.itemType,
          pluginName: item.pluginName,
          source: item.source,
        });
        subscriptionItems.push({ id: item.id, price: item.price });

        if (item.itemType === "plugin" && item.pluginName) {
          activePlugins.push(item.pluginName);
        }
        continue;
      }

      elizaLogger.warn("[CLIENT-DIRECT] Invalid item or price", {
        userId,
        itemId: item.id,
        price: item.price,
        itemType: item.itemType,
      });
      return res.status(400).json({ error: `Invalid item or price: ${item.id}` });
    }

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
        await sanityClient
          .patch(user._id)
          .set({ stripeCustomerId })
          .commit();
        elizaLogger.debug("[CLIENT-DIRECT] Created Stripe customer", { userId, customerId: stripeCustomerId });
      } catch (error) {
        elizaLogger.error("[CLIENT-DIRECT] Failed to create Stripe customer", {
          userId,
          message: error.message,
          stack: error.stack,
        });
        return res.status(500).json({ error: "Server error: Failed to create Stripe customer" });
      }
    }

    let stripeProducts;
    try {
      stripeProducts = await stripe.products.list({
        limit: 100,
        active: true,
      });
    } catch (error) {
      elizaLogger.error("[CLIENT-DIRECT] Failed to fetch Stripe products", {
        userId,
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: "Server error: Failed to fetch Stripe products" });
    }

    const lineItems = [];
    const activePriceIds = [];
    const activeItemIds = validatedItems.map((item) => item.id);

    for (const item of validatedItems) {
      let product = stripeProducts.data.find((p) => p.metadata.sanityItemId === item.id && p.active);

      if (!product) {
        try {
          product = await stripe.products.create({
            name: item.name,
            description: item.description,
            metadata: {
              sanityItemId: item.id,
              itemType: item.itemType || "subscription",
              pluginName: item.pluginName || "",
            },
            active: true,
          });
          elizaLogger.debug("[CLIENT-DIRECT] Created Stripe product", { userId, itemId: item.id, productId: product.id });
        } catch (error) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to create Stripe product", {
            userId,
            itemId: item.id,
            message: error.message,
            stack: error.stack,
          });
          continue;
        }
      } else if (
        product.name !== item.name ||
        product.description !== item.description ||
        product.metadata.itemType !== (item.itemType || "subscription") ||
        product.metadata.pluginName !== (item.pluginName || "")
      ) {
        try {
          product = await stripe.products.update(product.id, {
            name: item.name,
            description: item.description,
            metadata: {
              sanityItemId: item.id,
              itemType: item.itemType || "subscription",
              pluginName: item.pluginName || "",
            },
          });
          elizaLogger.debug("[CLIENT-DIRECT] Updated Stripe product", { userId, itemId: item.id, productId: product.id });
        } catch (error) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to update Stripe product", {
            userId,
            itemId: item.id,
            message: error.message,
            stack: error.stack,
          });
          continue;
        }
      }

      let prices;
      try {
        prices = await stripe.prices.list({
          product: product.id,
          active: true,
          limit: 100,
        });
      } catch (error) {
        elizaLogger.error("[CLIENT-DIRECT] Failed to fetch Stripe prices", {
          userId,
          productId: product.id,
          message: error.message,
          stack: error.stack,
        });
        continue;
      }

      let price = prices.data.find(
        (p) => p.unit_amount === item.price && p.recurring?.interval === "month"
      );

      if (!price) {
        try {
          price = await stripe.prices.create({
            product: product.id,
            unit_amount: item.price,
            currency: "usd",
            recurring: { interval: "month" },
            metadata: { sanityItemId: item.id },
          });
          elizaLogger.debug("[CLIENT-DIRECT] Created Stripe price", { userId, itemId: item.id, priceId: price.id });
        } catch (error) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to create Stripe price", {
            userId,
            itemId: item.id,
            message: error.message,
            stack: error.stack,
          });
          continue;
        }
      }

      lineItems.push({
        price: price.id,
        quantity: 1,
      });

      activePriceIds.push(price.id);

      if (item._id && (!item.stripePriceId || item.stripePriceId !== price.id)) {
        try {
          await sanityClient
            .patch(item._id)
            .set({ stripePriceId: price.id })
            .commit();
          elizaLogger.debug("[CLIENT-DIRECT] Updated Sanity item with stripePriceId", { userId, itemId: item.id, priceId: price.id });
        } catch (error) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to update Sanity item", {
            userId,
            itemId: item.id,
            message: error.message,
            stack: error.stack,
          });
        }
      }
    }

    if (lineItems.length === 0) {
      elizaLogger.warn("[CLIENT-DIRECT] No valid line items created", { userId });
      return res.status(400).json({ error: "No valid subscription items to process" });
    }

    // Check trial eligibility directly from Sanity user data
    const isTrialEligible = !user.hasUsedTrial && user.trialEndDate && new Date(user.trialEndDate) < new Date();
    const trialPeriodDays = isTrialEligible ? 7 : null;

    if (isTrialEligible) {
      elizaLogger.debug("[CLIENT-DIRECT] User eligible for trial", { userId, trialPeriodDays });
    } else {
      elizaLogger.debug("[CLIENT-DIRECT] User not eligible for trial", { userId, hasUsedTrial: user.hasUsedTrial });
    }

    const subscriptionData: any = {
      metadata: { userId },
    };
    if (trialPeriodDays !== null) {
      subscriptionData.trial_period_days = trialPeriodDays;
    }

    let checkoutSession;
    try {
      elizaLogger.debug("[CLIENT-DIRECT] Creating Checkout Session", { userId, trialDays: trialPeriodDays || "none" });
      checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "subscription",
        success_url: `${websiteDomain}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${websiteDomain}/cancel`,
        metadata: { userId },
        customer: stripeCustomerId,
        billing_address_collection: "auto",
        subscription_data: subscriptionData,
      });
    } catch (error) {
      elizaLogger.error("[CLIENT-DIRECT] Failed to create Checkout Session", {
        userId,
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: "Server error: Failed to create checkout session" });
    }

    if (!checkoutSession.url) {
      elizaLogger.error("[CLIENT-DIRECT] Checkout Session created but URL is missing", { userId, checkoutSession });
      return res.status(500).json({ error: "Failed to generate checkout session URL" });
    }

    if (checkoutSession.subscription) {
      const subscriptionId = typeof checkoutSession.subscription === "string"
        ? checkoutSession.subscription
        : checkoutSession.subscription.id;

      try {
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { userId },
        });

        await sanityClient
          .patch(user._id)
          .set({
            activePriceIds,
            activePlugins,
            hasUsedTrial: trialPeriodDays !== null ? true : user.hasUsedTrial,
          })
          .commit();

        elizaLogger.debug("[CLIENT-DIRECT] Updated subscription and user data", {
          userId,
          subscriptionId,
          activePriceIds,
          activePlugins,
          hasUsedTrial: trialPeriodDays !== null ? true : user.hasUsedTrial,
        });
      } catch (error) {
        elizaLogger.error("[CLIENT-DIRECT] Failed to update subscription or user data", {
          userId,
          subscriptionId,
          message: error.message,
          stack: error.stack,
        });
        // Continue to return the checkout URL to avoid blocking the user
      }
    }

    setTimeout(() => cleanupUnusedProducts(activeItemIds), 0);

    res.json({
      checkoutUrl: checkoutSession.url,
      trialEligible: isTrialEligible,
      trialDays: trialPeriodDays,
    });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error in checkout-session", {
      userId: req.userId,
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Failed to create checkout session",
      details: error.message,
    });
  }
});



// 3. Handle webhook events for Stripe (multiple events processed in order)
// POST /webhook
// Processes various Stripe webhook events (e.g., subscription updates, invoice events) to keep system in sync
router.post("/webhook", bodyParser.raw({ type: "application/json" }),  async (req, res) => {
    elizaLogger.debug("[CLIENT-DIRECT] [WEBHOOK] Received webhook request", {
      headers: req.headers,
      bodyLength: req.body?.length,
      isBuffer: Buffer.isBuffer(req.body),
      bodyType: typeof req.body,
    });

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        elizaLogger.error("[CLIENT-DIRECT] [WEBHOOK] STRIPE_WEBHOOK_SECRET is not set");
        return res.status(500).json({ error: "Server configuration error: Missing webhook secret" });
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      elizaLogger.debug("[CLIENT-DIRECT] [WEBHOOK] Webhook event constructed", { type: event.type, id: event.id });
    } catch (err) {
      elizaLogger.error("[CLIENT-DIRECT] [WEBHOOK] Webhook signature verification failed", {
        message: err.message,
        signature: sig,
      });
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    try {
      switch (event.type) {
  case "customer.subscription.created":
  case "customer.subscription.updated":
    await handleSubscriptionUpdate(event);
    break;
  case "customer.subscription.deleted":
    await handleSubscriptionDelete(event);
    break;
  case "checkout.session.completed":
    await handleCheckoutCompleted(event);
    break;
  case "invoice.created":
    await handleInvoiceCreated(event);
    break;
  case "invoice.paid":
    await handleInvoicePaid(event);
    break;
  case "invoice.payment_failed":
    await handleInvoicePaymentFailed(event);
    break;
  default:
    elizaLogger.debug("[CLIENT-DIRECT] Unhandled event type", { type: event.type });
}
      res.json({ received: true });
    } catch (err) {
      elizaLogger.error("[CLIENT-DIRECT] [WEBHOOK] Error processing webhook event", {
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



// 4. Handle checkout session completion
// async function handleCheckoutCompleted
// Updates user subscription data in Sanity after a successful checkout session
async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  
  if (!userId) {
    elizaLogger.warn("[CLIENT-DIRECT] No userId in session metadata", {
      eventType: event.type,
      sessionId: session.id,
    });
    throw new Error("[CLIENT-DIRECT] No userId in session metadata");
  }

  const user = await sanityClient.fetch(
    `*[_type == "User" && userId == $userId][0]`,
    { userId }
  );
  
  if (!user) {
    elizaLogger.warn("[CLIENT-DIRECT] User not found for userId", { userId });
    throw new Error(`[CLIENT-DIRECT] User not found for userId: ${userId}`);
  }

  const subscriptionId = session.subscription as string;
  
  if (!subscriptionId) {
    elizaLogger.warn("[CLIENT-DIRECT] No subscription in session", { sessionId: session.id });
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  });

  const activePriceIds = (subscription as any).items.data.map((item: any) => item.price.id);

  // Fetch plugin items from Sanity to determine active plugins
  const pluginItems = await sanityClient.fetch(
    `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
    { activePriceIds }
  );
  const activePlugins = pluginItems.map(item => item.pluginName);

  // Calculate current period dates with fallbacks
  const currentPeriodStart = (subscription as any).current_period_start
    ? new Date((subscription as any).current_period_start * 1000).toISOString()
    : user.currentPeriodStart || new Date().toISOString();
    
  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000).toISOString()
    : user.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Calculate trial dates with fallbacks to preserve existing data
  const trialStartDate = (subscription as any).trial_start
    ? new Date((subscription as any).trial_start * 1000).toISOString()
    : user.trialStartDate;
    
  const trialEndDate = (subscription as any).trial_end
    ? new Date((subscription as any).trial_end * 1000).toISOString()
    : user.trialEndDate;

  await sanityClient
    .patch(user._id)
    .set({
      subscriptionStatus: (subscription as any).status,
      stripeSubscriptionId: subscriptionId,
      trialStartDate,
      trialEndDate,
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      activePriceIds,
      activePlugins, // New: store active plugins based on subscribed price IDs
      hasUsedTrial: (subscription as any).trial_start ? true : user.hasUsedTrial || false,
      currentPeriodStart,
      currentPeriodEnd,
      responseCount: 0, // Reset counters on subscription update
      tokenCount: 0,
    })
    .commit();

  elizaLogger.debug("[CLIENT-DIRECT] Updated subscription from checkout", {
    userId,
    subscriptionId,
    activePriceIds,
    activePlugins,
    subscriptionStatus: (subscription as any).status,
    trialStartDate,
    trialEndDate,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
  });
}



// 5. Handle invoice creation
// async function handleInvoiceCreated
// Stores or updates invoice data in Sanity when a new invoice is created
async function handleInvoiceCreated(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  elizaLogger.debug("[CLIENT-DIRECT] [WEBHOOK] Processing invoice.created event", {
    eventType: event.type,
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });

  // Retrieve the invoice with expanded price and product data
  const expandedInvoice = await stripe.invoices.retrieve(invoice.id, {
    expand: ['lines.data.price', 'lines.data.price.product'],
  });

  const customer = invoice.customer
    ? await stripe.customers.retrieve(invoice.customer as string)
    : null;

  // Type guard to check if customer is not a DeletedCustomer
  if (!customer || 'deleted' in customer) {
    elizaLogger.warn("[CLIENT-DIRECT] No valid customer found for invoice", {
      eventType: event.type,
      invoiceId: invoice.id,
      customerId: invoice.customer,
    });
    throw new Error("[CLIENT-DIRECT] No valid customer found for invoice");
  }

  const userId = customer.metadata?.userId || null;
  if (!userId) {
    elizaLogger.warn("[CLIENT-DIRECT] No userId in invoice customer metadata", {
      eventType: event.type,
      invoiceId: invoice.id,
      customerId: invoice.customer,
    });
    throw new Error("[CLIENT-DIRECT] No userId in invoice customer metadata");
  }

  const user = await sanityClient.fetch(
    `*[_type == "User" && userId == $userId][0]`,
    { userId }
  );

  if (!user) {
    elizaLogger.warn("[CLIENT-DIRECT] User not found for userId", {
      userId,
      invoiceId: invoice.id,
    });
    throw new Error(`[CLIENT-DIRECT] User not found for userId: ${userId}`);
  }

  // Log user subscription details for reference
  elizaLogger.debug("[CLIENT-DIRECT] Fetched user for invoice", {
    userId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    subscriptionStatus: user.subscriptionStatus,
  });

  // Map line items for Sanity
  const lineItems = expandedInvoice.lines.data.map((line: Stripe.InvoiceLineItem) => {
    const price = line.price as Stripe.Price | null;
    let productName = 'Unknown Product';

    if (price?.product && typeof price.product !== 'string') {
      productName = (price.product as Stripe.Product).name || line.description || 'Unknown Product';
    } else if (line.description) {
      // Fallback to description for trial periods or when product is not available
      productName = line.description.replace(/^Trial period for /i, '');
    }

    return {
      _key: randomUUID(), // Generate unique key for Sanity
      description: line.description || 'No description',
      amount: line.amount / 100,
      currency: line.currency,
      quantity: line.quantity || 1,
      period: {
        start: line.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
        end: line.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
      },
      productName,
    };
  });

  // Store invoice in Sanity with line items
  const invoiceData = {
    _type: "invoice",
    user: { _type: "reference", _ref: user._id },
    stripeInvoiceId: invoice.id,
    status: invoice.status || "draft",
    amountDue: invoice.amount_due / 100,
    amountPaid: invoice.amount_paid / 100,
    currency: invoice.currency,
    createdAt: new Date(invoice.created * 1000).toISOString(),
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
    invoiceUrl: invoice.hosted_invoice_url || null,
    invoicePdf: invoice.invoice_pdf || null,
    periodStart: invoice.lines.data[0]?.period?.start
      ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
      : null,
    periodEnd: invoice.lines.data[0]?.period?.end
      ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
      : null,
    lineItems,
  };

  elizaLogger.debug("[CLIENT-DIRECT] Prepared invoice data for Sanity", {
    invoiceId: invoice.id,
    userId,
    lineItemsCount: lineItems.length,
  });

  const existingInvoice = await sanityClient.fetch(
    `*[_type == "invoice" && stripeInvoiceId == $stripeInvoiceId][0]`,
    { stripeInvoiceId: invoice.id }
  );

  if (!existingInvoice) {
    const createdInvoice = await sanityClient.create(invoiceData);
    elizaLogger.debug("[CLIENT-DIRECT] Created invoice in Sanity", {
      userId,
      invoiceId: invoice.id,
      sanityInvoiceId: createdInvoice._id,
      lineItemsCount: lineItems.length,
    });
  } else {
    const updatedInvoice = await sanityClient
      .patch(existingInvoice._id)
      .set({
        status: invoice.status,
        amountDue: invoice.amount_due / 100,
        amountPaid: invoice.amount_paid / 100,
        invoiceUrl: invoice.hosted_invoice_url || null,
        invoicePdf: invoice.invoice_pdf || null,
        lineItems,
      })
      .commit();
    elizaLogger.debug("[CLIENT-DIRECT] Updated invoice in Sanity", {
      userId,
      invoiceId: invoice.id,
      sanityInvoiceId: existingInvoice._id,
      lineItemsCount: lineItems.length,
    });
  }
}



// 6. Handle successful invoice payment
// async function handleInvoicePaid
// Updates invoice status in Sanity to reflect successful payment
async function handleInvoicePaid(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customer = invoice.customer
    ? await stripe.customers.retrieve(invoice.customer as string)
    : null;

  // Type guard to check if customer is not a DeletedCustomer
  if (!customer || 'deleted' in customer) {
    elizaLogger.warn("[CLIENT-DIRECT] No valid customer found for invoice", {
      eventType: event.type,
      invoiceId: invoice.id,
    });
    throw new Error("[CLIENT-DIRECT] No valid customer found for invoice");
  }

  const userId = customer.metadata?.userId || null;

  if (!userId) {
    elizaLogger.warn("[CLIENT-DIRECT] No userId in invoice customer metadata", {
      eventType: event.type,
      invoiceId: invoice.id,
    });
    throw new Error("[CLIENT-DIRECT] No userId in invoice customer metadata");
  }

  // Retrieve the invoice with expanded price and product data
  const expandedInvoice = await stripe.invoices.retrieve(invoice.id, {
    expand: ['lines.data.price', 'lines.data.price.product'],
  });

  const existingInvoice = await sanityClient.fetch(
    `*[_type == "invoice" && stripeInvoiceId == $stripeInvoiceId][0]`,
    { stripeInvoiceId: invoice.id }
  );

  if (existingInvoice) {
    const lineItems = expandedInvoice.lines.data.map((line: Stripe.InvoiceLineItem) => {
      const price = line.price as Stripe.Price | null;
      let productName = 'Unknown Product';

      if (price?.product && typeof price.product !== 'string') {
        productName = (price.product as Stripe.Product).name || line.description || 'Unknown Product';
      } else if (line.description) {
        productName = line.description.replace(/^Trial period for /i, '');
      }

      return {
        _key: randomUUID(),
        description: line.description || 'No description',
        amount: line.amount / 100,
        currency: line.currency,
        quantity: line.quantity || 1,
        period: {
          start: line.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
          end: line.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
        },
        productName,
      };
    });

    await sanityClient
      .patch(existingInvoice._id)
      .set({
        status: invoice.status,
        amountPaid: invoice.amount_paid / 100,
        invoiceUrl: invoice.hosted_invoice_url || null,
        invoicePdf: invoice.invoice_pdf || null,
        lineItems,
      })
      .commit();
    elizaLogger.debug("[CLIENT-DIRECT] Updated invoice status to paid", {
      userId,
      invoiceId: invoice.id,
      lineItemsCount: lineItems.length,
    });
  }
}



// 7. Handle failed invoice payment
// async function handleInvoicePaymentFailed
// Updates invoice status in Sanity and may trigger retry logic for failed payments
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const customer = invoice.customer
    ? await stripe.customers.retrieve(invoice.customer as string)
    : null;

  if (!customer || 'deleted' in customer) {
    elizaLogger.warn("[CLIENT-DIRECT] No valid customer found for invoice", {
      eventType: event.type,
      invoiceId: invoice.id,
    });
    throw new Error("[CLIENT-DIRECT] No valid customer found for invoice");
  }

  const userId = customer.metadata?.userId || null;


  if (!userId) {
    elizaLogger.warn("[CLIENT-DIRECT] No userId in invoice customer metadata", {
      eventType: event.type,
      invoiceId: invoice.id,
    });
    throw new Error("[CLIENT-DIRECT] No userId in invoice customer metadata");
  }

  const existingInvoice = await sanityClient.fetch(
    `*[_type == "invoice" && stripeInvoiceId == $stripeInvoiceId][0]`,
    { stripeInvoiceId: invoice.id }
  );

  if (existingInvoice) {
    await sanityClient
      .patch(existingInvoice._id)
      .set({
        status: invoice.status,
        invoiceUrl: invoice.hosted_invoice_url || null,
        invoicePdf: invoice.invoice_pdf || null,
      })
      .commit();
    elizaLogger.debug("[CLIENT-DIRECT] Updated invoice status to payment_failed", {
      userId,
      invoiceId: invoice.id,
    });

    // Optionally notify user or trigger retry logic
    // Example: Send email or update user status
  }
}



// 8. Handle subscription updates
// async function handleSubscriptionUpdate
// Updates user subscription details in Sanity when a subscription is created or updated
async function handleSubscriptionUpdate(event: Stripe.Event) {
  const subscription = event.data.object as any;
  const userId = subscription.metadata?.userId;
  const status = subscription.status;

  if (!userId) {
    throw new Error("[CLIENT-DIRECT] No userId in subscription metadata");
  }

  const user = await sanityClient.fetch(
    `*[_type == "User" && userId == $userId][0]`,
    { userId }
  );
  if (!user) {
    throw new Error(`[CLIENT-DIRECT] User not found for userId: ${userId}`);
  }

  const subscriptionItems = await stripe.subscriptions.retrieve(subscription.id, {
    expand: ['items.data.price'],
  });
  const activePriceIds = subscriptionItems.items.data.map((item: any) => item.price.id);
  const pluginItems = await sanityClient.fetch(
    `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
    { activePriceIds }
  );
  const activePlugins = pluginItems.map(item => item.pluginName);

  const updateData: any = {
    subscriptionStatus: status,
    stripeSubscriptionId: subscription.id,
    trialStartDate: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : user.trialStartDate,
    trialEndDate: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : user.trialEndDate,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    activePriceIds,
    activePlugins,
    hasUsedTrial: subscription.trial_start ? true : user.hasUsedTrial || false,
    currentPeriodStart: subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : user.currentPeriodStart || new Date().toISOString(),
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : user.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (status === "past_due") {
    updateData.activePriceIds = [];
    updateData.activePlugins = [];
  }

  await sanityClient.patch(user._id).set(updateData).commit();

  elizaLogger.debug("[CLIENT-DIRECT] Updated subscription status", {
    userId,
    status,
    subscriptionId: subscription.id,
    activePriceIds,
    activePlugins,
  });
}



// 9. Handle subscription deletion
// async function handleSubscriptionDelete
// Clears subscription data in Sanity when a subscription is canceled
async function handleSubscriptionDelete(event) {
  const subscription = event.data.object;
  const userId = subscription.metadata?.userId;
  const status = subscription.status;

  if (!userId) {
    elizaLogger.warn("[CLIENT-DIRECT] No userId in subscription metadata", {
      eventType: event.type,
      subscriptionId: subscription.id,
    });
    throw new Error("[CLIENT-DIRECT] No userId in subscription metadata");
  }

  const user = await sanityClient.fetch(
    `*[_type == "User" && userId == $userId][0]`,
    { userId }
  );

  if (!user) {
    elizaLogger.warn("[CLIENT-DIRECT] User not found for userId", { userId });
    throw new Error(`[CLIENT-DIRECT] User not found for userId: ${userId}`);
  }

  await sanityClient
    .patch(user._id)
    .set({
      subscriptionStatus: status,
      stripeSubscriptionId: null,
      trialStartDate: undefined,
      trialEndDate: undefined,
      cancelAtPeriodEnd: false,
      activePriceIds: [],
      activePlugins: [], // Clear activePlugins
    })
    .commit();
  
  elizaLogger.debug("[CLIENT-DIRECT] Cleared subscription data", {
    userId,
    status,
    subscriptionId: subscription.id,
    activePriceIds: [],
    activePlugins: [],
  });
}



// 10. Create a billing portal session for subscription management
// POST /create-portal-session
// Creates a Stripe Billing Portal session for users to manage their subscriptions
router.post("/create-portal-session", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware
    if (!userId) {
      elizaLogger.error("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] User not found for userId=${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found" });
    }

    const now = new Date();
    const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
    const isTrialActive = trialEndDate && now <= trialEndDate;

    if (!user.stripeSubscriptionId && (!isTrialActive || user.subscriptionStatus === "none")) {
      elizaLogger.info("[CLIENT-DIRECT] No active subscription for user", { userId });
      return res.status(400).json({ error: "No active subscription. Please subscribe to a plan." });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.WEBSITE_DOMAIN}/settings`,
    });

    res.json({ url: portalSession.url });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /create-portal-session endpoint:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to create portal session", details: error.message });
  }
});



// 11. Cancel a subscription
// POST /cancel-subscription
// Sets a subscription to cancel at the end of the billing period
router.post("/cancel-subscription", checkoutLimiter, requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      elizaLogger.error("[CLIENT-DIRECT] STRIPE_SECRET_KEY is not set in environment variables");
      return res.status(500).json({ error: "Server configuration error: Missing Stripe secret key" });
    }

    const userId = req.userId; // Sanity UUID from requireAuth middleware

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found in Sanity for userId=${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    const stripeSubscriptionId = user.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      elizaLogger.warn(`[CLIENT-DIRECT] No subscription found for userId=${userId}`);
      return res.status(400).json({ error: "[CLIENT-DIRECT] No active subscription found" });
    }

    const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await sanityClient
      .patch(user._id)
      .set({
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: true,
        activePriceIds: [],
        activePlugins: [],
      })
      .commit();

    elizaLogger.debug(`[CLIENT-DIRECT] Subscription ${stripeSubscriptionId} for userId=${userId} set to cancel at period end`);
    res.json({ message: "[CLIENT-DIRECT] Subscription will cancel at the end of the billing period" });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error in cancel-subscription:", {
      message: error.message,
      type: error.type,
      code: error.code,
      raw: error.raw,
    });
    res.status(500).json({ error: "Failed to cancel subscription", details: error.message });
  }
});



// 12. Update the base plan of a subscription
// POST /subscription/update-base-plan
// Updates the base plan of an existing subscription
router.post("/subscription/update-base-plan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware
    const { newBasePlanId } = req.body;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    if (!newBasePlanId) {
      return res.status(400).json({ error: "New base plan ID is required" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const newBaseItem = await sanityClient.fetch(
      `*[_type == "Item" && id == $newBasePlanId && itemType == "base"][0]`,
      { newBasePlanId }
    );

    if (!newBaseItem || !newBaseItem.stripePriceId) {
      return res.status(404).json({ error: "Base plan not found or misconfigured" });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price.product"],
    });

    const currentBaseItem = subscription.items.data.find((item) =>
      typeof item.price.product === "object" &&
      item.price.product !== null &&
      "metadata" in item.price.product &&
      (item.price.product as any).metadata?.itemType === "base"
    );

    if (!currentBaseItem) {
      return res.status(400).json({ error: "No current base plan found" });
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: currentBaseItem.id, price: newBaseItem.stripePriceId }],
    });

    const updatedSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    const activePriceIds = updatedSubscription.items.data.map((item) => item.price.id);

    await sanityClient.patch(user._id).set({ activePriceIds }).commit();

    res.json({ success: true });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error updating base plan:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to update base plan", details: error.message });
  }
});



// 13. Add a plugin to a subscription
// POST /subscription/add-plugin
// Adds a plugin to an existing subscription
router.post("/subscription/add-plugin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware
    const { pluginName } = req.body;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    if (!pluginName) {
      return res.status(400).json({ error: "Plugin name is required" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const pluginItem = await sanityClient.fetch(
      `*[_type == "Item" && itemType == "plugin" && pluginName == $pluginName][0]`,
      { pluginName }
    );

    if (!pluginItem || !pluginItem.stripePriceId) {
      return res.status(404).json({ error: "Plugin not found" });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    if (subscription.items.data.some((item) => item.price.id === pluginItem.stripePriceId)) {
      return res.status(400).json({ error: "Plugin already subscribed" });
    }

    const updatedItems = [
      ...subscription.items.data.map((item) => ({ id: item.id, price: item.price.id })),
      { price: pluginItem.stripePriceId },
    ];

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: updatedItems,
    });

    const updatedSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    const activePriceIds = updatedSubscription.items.data.map((item) => item.price.id);
    const pluginItems = await sanityClient.fetch(
      `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
      { activePriceIds }
    );
    const activePlugins = pluginItems.map((item) => item.pluginName);

    await sanityClient.patch(user._id).set({ activePriceIds, activePlugins }).commit();

    res.json({ success: true });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error adding plugin:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to add plugin", details: error.message });
  }
});



// 14. Remove a plugin from a subscription
// POST /subscription/remove-plugin
// Removes a plugin from an existing subscription
router.post("/subscription/remove-plugin", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware
    const { pluginName } = req.body;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    if (!pluginName) {
      return res.status(400).json({ error: "Plugin name is required" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription" });
    }

    const charactersUsingPlugin = await sanityClient.fetch(
      `*[_type == "character" && createdBy._ref == $userId && $pluginName in plugins]`,
      { userId: user._id, pluginName }
    );

    if (charactersUsingPlugin.length > 0) {
      const characterNames = charactersUsingPlugin.map((char: any) => char.name).join(", ");
      return res.status(400).json({
        error: `Cannot remove plugin "${pluginName}" because it is still enabled for the following characters: ${characterNames}. Please delete those characters first.`,
      });
    }

    const pluginItem = await sanityClient.fetch(
      `*[_type == "Item" && itemType == "plugin" && pluginName == $pluginName][0]`,
      { pluginName }
    );

    if (!pluginItem || !pluginItem.stripePriceId) {
      return res.status(404).json({ error: "Plugin not found" });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    const itemToRemove = subscription.items.data.find((item) => item.price.id === pluginItem.stripePriceId);
    if (!itemToRemove) {
      return res.status(400).json({ error: "Plugin not subscribed" });
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: itemToRemove.id, deleted: true }],
    });

    const updatedSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ["items.data.price"],
    });

    const activePriceIds = updatedSubscription.items.data.map((item) => item.price.id);
    const pluginItems = await sanityClient.fetch(
      `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
      { activePriceIds }
    );
    const activePlugins = pluginItems.map((item) => item.pluginName);

    await sanityClient.patch(user._id).set({ activePriceIds, activePlugins }).commit();

    res.json({ success: true });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error removing plugin:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to remove plugin", details: error.message });
  }
});



// 15. Retrieve subscription status
// GET /subscription-status
// Retrieves the current subscription status for a user
router.get("/subscription-status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] User not found for userId=${userId}`);
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
    elizaLogger.error("[CLIENT-DIRECT] Error in /subscription-status endpoint:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch subscription status", details: error.message });
  }
});



// 16. Retrieve subscription items
// GET /subscription-items
// Retrieves active subscription items and plugins for a user
router.get("/subscription-items", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId in /subscription-items request");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Not authenticated" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]{
        _id,
        subscriptionStatus,
        stripeSubscriptionId,
        activePriceIds,
        activePlugins,
        currentPeriodStart,
        currentPeriodEnd,
        trialStartDate,
        trialEndDate,
        cancelAtPeriodEnd
      }`,
      { userId }
    );

    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found in Sanity for userId=${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found" });
    }

    const hasActiveSubscription = user.subscriptionStatus === "active" || user.subscriptionStatus === "trialing";

    let activePriceIds = user.activePriceIds || [];
    let activePlugins = user.activePlugins || [];
    let subscriptionData = {
      currentPeriodStart: user.currentPeriodStart,
      currentPeriodEnd: user.currentPeriodEnd,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    };

    if (user.stripeSubscriptionId && (!activePriceIds || activePriceIds.length === 0)) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ["items.data.price", "items.data.price.product"],
        });

        activePriceIds = subscription.items.data.map((item) => item.price.id);
        subscriptionData = {
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          trialStartDate: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : user.trialStartDate,
          trialEndDate: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : user.trialEndDate,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        };

        if (activePriceIds.length > 0) {
          const pluginItems = await sanityClient.fetch(
            `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
            { activePriceIds }
          );
          activePlugins = pluginItems.map((item) => item.pluginName).filter(Boolean);

          sanityClient
            .patch(user._id)
            .set({
              activePriceIds,
              activePlugins,
              ...subscriptionData,
            })
            .commit()
            .then(() => {
              elizaLogger.debug(`[CLIENT-DIRECT] Updated user ${userId} with data from Stripe`);
            })
            .catch((error) => {
              elizaLogger.error(`[CLIENT-DIRECT] Failed to update user ${userId} with Stripe data`, {
                error: error.message,
              });
            });
        }
      } catch (stripeError) {
        elizaLogger.error(`[CLIENT-DIRECT] Failed to fetch subscription from Stripe for user ${userId}`, {
          error: stripeError.message,
        });
      }
    } else if (user.stripeSubscriptionId) {
      if (activePriceIds.length > 0 && (!activePlugins || activePlugins.length === 0)) {
        try {
          const pluginItems = await sanityClient.fetch(
            `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
            { activePriceIds }
          );
          activePlugins = pluginItems.map((item) => item.pluginName).filter(Boolean);

          if (activePlugins.length > 0) {
            sanityClient
              .patch(user._id)
              .set({ activePlugins })
              .commit()
              .then(() => {
                elizaLogger.debug(`[CLIENT-DIRECT] Updated user ${userId} with activePlugins`);
              })
              .catch((error) => {
                elizaLogger.error(`[CLIENT-DIRECT] Failed to update user ${userId} with activePlugins`, {
                  error: error.message,
                });
              });
          }
        } catch (pluginError) {
          elizaLogger.warn(`[CLIENT-DIRECT] Failed to fetch plugin names for user ${userId}`, {
            error: pluginError.message,
          });
        }
      }
    }

    let subscriptionItems = [];
    if (req.query.includeDetails === "true" && (activePriceIds.length > 0 || activePlugins.length > 0)) {
      const items = await sanityClient.fetch(
        `*[_type == "Item" && (stripePriceId in $priceIds || pluginName in $pluginNames)]{
          id,
          name,
          description,
          price,
          stripePriceId,
          pluginName,
          itemType,
          features,
          isPopular,
          trialInfo,
          useCase
        }`,
        { priceIds: activePriceIds, pluginNames: activePlugins }
      );

      const foundPriceIds = items.map((item) => item.stripePriceId).filter(Boolean);
      const missingPriceIds = activePriceIds.filter((id) => !foundPriceIds.includes(id));

      if (missingPriceIds.length > 0) {
        for (const priceId of missingPriceIds) {
          try {
            const price = await stripe.prices.retrieve(priceId, {
              expand: ["product"],
            });

            if (typeof price.product === "object" && price.product !== null) {
              const product = price.product;
              items.push({
                id: "metadata" in product && product.metadata?.sanityItemId ? product.metadata.sanityItemId : `stripe_${product.id}`,
                name: "name" in product ? product.name : "Unknown Product",
                description: "description" in product ? product.description || "" : "",
                price: price.unit_amount,
                stripePriceId: price.id,
                itemType: "unknown",
              });
            } else {
              const productId = typeof price.product === "string" ? price.product : "";
              if (productId) {
                const product = await stripe.products.retrieve(productId);
                items.push({
                  id: product.metadata?.sanityItemId || `stripe_${product.id}`,
                  name: product.name || "Unknown Product",
                  description: product.description || "",
                  price: price.unit_amount,
                  stripePriceId: price.id,
                  itemType: "unknown",
                });
              }
            }
          } catch (err) {
            elizaLogger.warn(`[CLIENT-DIRECT] Failed to fetch details for price ${priceId}`, {
              error: err.message,
            });
          }
        }
      }

      subscriptionItems = items;
    }

    res.json({
      active: hasActiveSubscription,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionId: user.stripeSubscriptionId,
      priceIds: activePriceIds,
      plugins: activePlugins,
      items: subscriptionItems,
      currentPeriodStart: subscriptionData.currentPeriodStart,
      currentPeriodEnd: subscriptionData.currentPeriodEnd,
      trialStartDate: subscriptionData.trialStartDate,
      trialEndDate: subscriptionData.trialEndDate,
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
    });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /subscription-items:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "[CLIENT-DIRECT] Failed to fetch subscription items",
      details: error.message,
    });
  }
});



// 17. Retrieve invoices for a user
// GET /invoices
// Fetches all invoices associated with a user's subscription
router.get("/invoices", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]{_id, stripeSubscriptionId}`,
      { userId }
    );

    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] User not found for userId=${userId}`);
      return res.status(404).json({ error: "User not found" });
    }

    const invoices = await sanityClient.fetch(
      `*[_type == "invoice" && user._ref == $userId] | order(createdAt desc) {
        _id,
        stripeInvoiceId,
        status,
        amountDue,
        amountPaid,
        currency,
        createdAt,
        dueDate,
        invoiceUrl,
        invoicePdf,
        periodStart,
        periodEnd,
        lineItems[] {
          description,
          amount,
          currency,
          quantity,
          period { start, end },
          productName
        }
      }`,
      { userId: user._id }
    );

    elizaLogger.debug("[CLIENT-DIRECT] Fetched invoices for user", {
      userId,
      userSubscriptionId: user.stripeSubscriptionId,
      invoiceCount: invoices.length,
      invoices: invoices.map((inv: any) => ({
        invoiceId: inv.stripeInvoiceId,
        status: inv.status,
        lineItemsCount: inv.lineItems?.length || 0,
      })),
    });

    res.json({ invoices, subscriptionId: user.stripeSubscriptionId || null });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /invoices endpoint:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch invoices", details: error.message });
  }
});



// 18. Retrieve a specific invoice by session ID
// GET /invoice
// Fetches details for a specific invoice tied to a checkout session
router.get("/invoice", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware
    const sessionId = req.query.sessionId as string;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    if (!sessionId) {
      elizaLogger.warn("[CLIENT-DIRECT] Missing sessionId in /invoice request");
      return res.status(400).json({ error: "Missing session ID" });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription.latest_invoice"],
    });

    if (!checkoutSession.customer || checkoutSession.metadata?.userId !== userId) {
      elizaLogger.warn("[CLIENT-DIRECT] Invalid session or user mismatch", {
        userId,
        sessionId,
      });
      return res.status(403).json({ error: "Invalid session or user mismatch" });
    }

    let invoice: Stripe.Invoice | null = null;
    if (checkoutSession.subscription && typeof checkoutSession.subscription !== "string") {
      invoice = checkoutSession.subscription.latest_invoice as Stripe.Invoice | null;
    }

    if (!invoice) {
      elizaLogger.warn("[CLIENT-DIRECT] No invoice found for session", { sessionId });
      return res.status(404).json({ error: "No invoice found for this session" });
    }

    const expandedInvoice = await stripe.invoices.retrieve(invoice.id, {
      expand: ["lines.data.price", "lines.data.price.product"],
    });

    const lineItems = expandedInvoice.lines.data.map((line: Stripe.InvoiceLineItem) => {
      const price = line.price as Stripe.Price | null;
      let productName = "Unknown Product";
      if (price?.product && typeof price.product !== "string") {
        productName = (price.product as Stripe.Product).name || line.description || "Unknown Product";
      } else if (line.description) {
        productName = line.description.replace(/^Trial period for /i, "");
      }

      return {
        _key: randomUUID(),
        description: line.description || "No description",
        amount: line.amount / 100,
        currency: line.currency,
        quantity: line.quantity || 1,
        period: {
          start: line.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
          end: line.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
        },
        productName,
      };
    });

    const invoiceData = {
      _id: `invoice_${invoice.id}`,
      stripeInvoiceId: invoice.id,
      status: invoice.status || "draft",
      amountDue: invoice.amount_due / 100,
      amountPaid: invoice.amount_paid / 100,
      currency: invoice.currency,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      invoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      periodStart: invoice.lines.data[0]?.period?.start
        ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
        : null,
      periodEnd: invoice.lines.data[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
        : null,
      lineItems,
    };

    elizaLogger.debug("[CLIENT-DIRECT] Fetched invoice for session", {
      userId,
      sessionId,
      invoiceId: invoice.id,
      lineItemsCount: lineItems.length,
    });

    res.json({ invoice: invoiceData });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /invoice endpoint:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch invoice", details: error.message });
  }
});



// 20. Sync items between Sanity and Stripe
// GET /sync-items
// Synchronizes item data (products and prices) between Sanity and Stripe
router.get("/sync-subscriptions", async (req, res) => {
  try {
    const users = await sanityClient.fetch(`*[_type == "User" && stripeCustomerId != null]{
      _id,
      userId,
      stripeCustomerId,
      subscriptionStatus,
      stripeSubscriptionId,
      activePriceIds,
      activePlugins
    }`);

    let syncedCount = 0;
    let errorCount = 0;
    let syncedInvoicesCount = 0;

    for (const user of users) {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          expand: ['data.items.data.price', 'data.items.data.price.product'],
        });

        const activeSub = subscriptions.data.find(sub =>
          ["active", "trialing", "past_due"].includes(sub.status)
        );

        // Sync invoices for this customer
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 100,
          expand: ['data.lines.data.price', 'data.lines.data.price.product'],
        });

        for (const invoice of invoices.data) {
          const lineItems = invoice.lines.data.map((line: Stripe.InvoiceLineItem) => {
            const price = line.price as Stripe.Price | null;
            let productName = 'Unknown Product';

            if (price?.product && typeof price.product !== 'string') {
              productName = (price.product as Stripe.Product).name || line.description || 'Unknown Product';
            } else if (line.description) {
              productName = line.description.replace(/^Trial period for /i, '');
            }

            return {
              _key: randomUUID(),
              description: line.description || 'No description',
              amount: line.amount / 100,
              currency: line.currency,
              quantity: line.quantity || 1,
              period: {
                start: line.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
                end: line.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
              },
              productName,
            };
          });

          const invoiceData = {
            _type: "invoice",
            user: { _type: "reference", _ref: user._id },
            stripeInvoiceId: invoice.id,
            status: invoice.status || "draft",
            amountDue: invoice.amount_due / 100,
            amountPaid: invoice.amount_paid / 100,
            currency: invoice.currency,
            createdAt: new Date(invoice.created * 1000).toISOString(),
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
            invoiceUrl: invoice.hosted_invoice_url || null,
            invoicePdf: invoice.invoice_pdf || null,
            periodStart: invoice.lines.data[0]?.period?.start
              ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
              : null,
            periodEnd: invoice.lines.data[0]?.period?.end
              ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
              : null,
            lineItems,
          };

          const existingInvoice = await sanityClient.fetch(
            `*[_type == "invoice" && stripeInvoiceId == $stripeInvoiceId][0]`,
            { stripeInvoiceId: invoice.id }
          );

          if (!existingInvoice) {
            await sanityClient.create(invoiceData);
            elizaLogger.debug("[CLIENT-DIRECT] Synced new invoice for user", {
              userId: user.userId,
              invoiceId: invoice.id,
              lineItemsCount: lineItems.length,
            });
            syncedInvoicesCount++;
          } else {
            await sanityClient
              .patch(existingInvoice._id)
              .set({
                status: invoice.status,
                amountDue: invoice.amount_due / 100,
                amountPaid: invoice.amount_paid / 100,
                invoiceUrl: invoice.hosted_invoice_url || null,
                invoicePdf: invoice.invoice_pdf || null,
                lineItems,
              })
              .commit();
            elizaLogger.debug("[CLIENT-DIRECT] Updated existing invoice for user", {
              userId: user.userId,
              invoiceId: invoice.id,
              lineItemsCount: lineItems.length,
            });
            syncedInvoicesCount++;
          }
        }

        if (activeSub) {
          const activePriceIds = activeSub.items.data.map(item => item.price.id);
          let activePlugins = [];
          if (activePriceIds.length > 0) {
            try {
              const pluginItems = await sanityClient.fetch(
                `*[_type == "Item" && itemType == "plugin" && stripePriceId in $activePriceIds]{pluginName}`,
                { activePriceIds }
              );
              activePlugins = pluginItems.map(item => item.pluginName).filter(Boolean);
            } catch (pluginError) {
              elizaLogger.warn(`[CLIENT-DIRECT] Failed to fetch plugin names for user ${user.userId}`, {
                error: pluginError.message
              });
            }
          }

          const sub = activeSub as any;
          const subscriptionData = {
            subscriptionStatus: activeSub.status,
            stripeSubscriptionId: activeSub.id,
            activePriceIds,
            activePlugins,
            currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
            trialStartDate: sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null,
            trialEndDate: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end || false
          };

          const hasChanges = (
            activeSub.status !== user.subscriptionStatus ||
            activeSub.id !== user.stripeSubscriptionId ||
            JSON.stringify(activePriceIds) !== JSON.stringify(user.activePriceIds || []) ||
            JSON.stringify(activePlugins) !== JSON.stringify(user.activePlugins || [])
          );

          if (hasChanges) {
            await sanityClient
              .patch(user._id)
              .set(subscriptionData)
              .commit();

            elizaLogger.debug(`[CLIENT-DIRECT] Synced subscription for user ${user.userId}:`, {
              status: activeSub.status,
              subscriptionId: activeSub.id,
              activePriceIds,
              activePlugins,
              currentPeriodEnd: subscriptionData.currentPeriodEnd
            });
            syncedCount++;
          }
        } else {
          const shouldClearData = ["active", "trialing", "past_due"].includes(user.subscriptionStatus);
          if (shouldClearData) {
            await sanityClient
              .patch(user._id)
              .set({
                subscriptionStatus: "inactive",
                stripeSubscriptionId: null,
                activePriceIds: [],
                activePlugins: [],
                cancelAtPeriodEnd: false,
                currentPeriodStart: null,
                currentPeriodEnd: null
              })
              .commit();

            elizaLogger.debug(`[CLIENT-DIRECT] Cleared subscription data for user ${user.userId} - no active subscription found`);
            syncedCount++;
          }
        }
      } catch (userError) {
        elizaLogger.error(`[CLIENT-DIRECT] Error syncing subscription for user ${user.userId}:`, {
          error: userError.message,
          userId: user.userId,
          stripeCustomerId: user.stripeCustomerId
        });
        errorCount++;
      }
    }

    elizaLogger.debug(`[CLIENT-DIRECT] Subscription sync completed:`, {
      totalUsers: users.length,
      syncedUsers: syncedCount,
      errors: errorCount,
      syncedInvoices: syncedInvoicesCount
    });

    res.json({ 
      success: true,
      synced: syncedCount,
      errors: errorCount,
      total: users.length,
      syncedInvoices: syncedInvoicesCount
    });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /sync-subscriptions endpoint:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ 
      error: "Failed to sync subscriptions",
      details: error.message 
    });
  }
});



// 21. Clean up unused Stripe products
// async function cleanupUnusedProducts
// Archives Stripe products that no longer have corresponding active items in Sanity
router.get("/sync-items", async (req, res) => {
  try {
    // Fetch all active Stripe products
    const stripeProducts = await stripe.products.list({ limit: 100, active: true });
    const stripePrices = await stripe.prices.list({ limit: 100, active: true });

    // Fetch all Sanity items
    const sanityItems = await sanityClient.fetch(`
      *[_type == "Item"]{
        _id,
        id,
        name,
        description,
        price,
        itemType,
        pluginName,
        stripePriceId,
        features,
        isPopular,
        trialInfo,
        useCase
      }
    `);

    let syncedCount = 0;
    let createdCount = 0;
    let errorCount = 0;

    // Process each Sanity item
    for (const sanityItem of sanityItems) {
      try {
        // Find matching Stripe product by metadata.sanityItemId or name
        let product = stripeProducts.data.find(
          (p) =>
            p.metadata.sanityItemId === sanityItem.id ||
            p.name === sanityItem.name
        );

        // If no matching product, create a new one
        if (!product) {
          product = await stripe.products.create({
            name: sanityItem.name,
            description: sanityItem.description || "",
            metadata: {
              sanityItemId: sanityItem.id,
              itemType: sanityItem.itemType || "subscription",
              pluginName: sanityItem.pluginName || "",
            },
            active: true,
          });
          elizaLogger.debug(
            `[CLIENT-DIRECT] Created Stripe product for Sanity item ${sanityItem.id}: ${product.id}`
          );
          createdCount++;
        } else if (
          product.name !== sanityItem.name ||
          product.description !== (sanityItem.description || "") ||
          product.metadata.itemType !== (sanityItem.itemType || "subscription") ||
          product.metadata.pluginName !== (sanityItem.pluginName || "")
        ) {
          // Update existing product if details have changed
          product = await stripe.products.update(product.id, {
            name: sanityItem.name,
            description: sanityItem.description || "",
            metadata: {
              sanityItemId: sanityItem.id,
              itemType: sanityItem.itemType || "subscription",
              pluginName: sanityItem.pluginName || "",
            },
          });
          elizaLogger.debug(
            `[CLIENT-DIRECT] Updated Stripe product ${product.id} for Sanity item ${sanityItem.id}`
          );
        }

        // Find or create a price for the product
        const prices = stripePrices.data.filter((p) => p.product === product.id);
        let price = prices.find(
          (p) =>
            p.unit_amount === sanityItem.price &&
            p.currency === "usd" &&
            p.recurring?.interval === "month"
        );

        if (!price) {
          price = await stripe.prices.create({
            product: product.id,
            unit_amount: sanityItem.price,
            currency: "usd",
            recurring: { interval: "month" },
            metadata: { sanityItemId: sanityItem.id },
          });
          elizaLogger.debug(
            `[CLIENT-DIRECT] Created Stripe price ${price.id} for item ${sanityItem.id}`
          );
          createdCount++;
        }

        // Update Sanity item with stripePriceId if missing or different
        if (!sanityItem.stripePriceId || sanityItem.stripePriceId !== price.id) {
          await sanityClient
            .patch(sanityItem._id)
            .set({ stripePriceId: price.id })
            .commit();
          elizaLogger.debug(
            `[CLIENT-DIRECT] Updated Sanity item ${sanityItem.id} with stripePriceId=${price.id}`
          );
          syncedCount++;
        }
      } catch (error) {
        elizaLogger.error(
          `[CLIENT-DIRECT] Error syncing item ${sanityItem.id}:`,
          {
            message: error.message,
            stack: error.stack,
          }
        );
        errorCount++;
      }
    }

    // Archive Stripe products that no longer have corresponding Sanity items
    const activeSanityItemIds = sanityItems.map((item) => item.id);
    const productsToArchive = stripeProducts.data.filter(
      (product) =>
        product.metadata.sanityItemId &&
        !activeSanityItemIds.includes(product.metadata.sanityItemId)
    );

    for (const product of productsToArchive) {
      await stripe.products.update(product.id, { active: false });
      elizaLogger.debug(
        `[CLIENT-DIRECT] Archived Stripe product ${product.id} with sanityItemId=${product.metadata.sanityItemId}`
      );
    }

    elizaLogger.debug(`[CLIENT-DIRECT] Item sync completed:`, {
      totalItems: sanityItems.length,
      syncedItems: syncedCount,
      createdItems: createdCount,
      archivedProducts: productsToArchive.length,
      errors: errorCount,
    });

    res.json({
      success: true,
      synced: syncedCount,
      created: createdCount,
      archived: productsToArchive.length,
      errors: errorCount,
      total: sanityItems.length,
    });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error in /sync-items endpoint:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: "Failed to sync items",
      details: error.message,
    });
  }
});


// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------


























































// Helper function user subscription limits
// Retrieves the subscription limits for a user based on their active plan or trial status
async function getUserSubscriptionLimits(userId: string): Promise<{ maxAgents: number; maxKnowledgeDocsPerAgent: number; maxTotalCharsPerAgent: number; maxCharsPerKnowledgeDoc?: number; }> {
  const maxRetries = 3;
  let user;

  // Retry fetching user data from Sanity
  for (let i = 0; i < maxRetries; i++) {
    try {
      user = await sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]{
          _id,
          activePriceIds,
          subscriptionStatus,
          trialEndDate,
          hasUsedTrial,
          activePlugins
        }`,
        { userId }
      );
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        elizaLogger.error("[SUBSCRIPTION_LIMITS] Failed to fetch user after retries", {
          userId,
          message: error.message,
          stack: error.stack,
        });
        throw new Error("Failed to fetch user data from database");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!user) {
    elizaLogger.error("[SUBSCRIPTION_LIMITS] User not found", { userId });
    throw new Error("User not found in database");
  }

  const now = new Date();
  const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
  const isTrialActive = user.subscriptionStatus === "trialing" && trialEndDate && now <= trialEndDate;

  // Reset activePlugins if trial has expired and no active subscription
  if (!isTrialActive && user.subscriptionStatus !== "active") {
    if (user.activePlugins && user.activePlugins.length > 0) {
      try {
        await sanityClient
          .patch(user._id)
          .set({ activePlugins: [] })
          .commit();
        elizaLogger.info("[SUBSCRIPTION_LIMITS] Reset activePlugins for expired trial", { userId });
        user.activePlugins = []; // Update local user object
      } catch (error) {
        elizaLogger.error("[SUBSCRIPTION_LIMITS] Failed to reset activePlugins", {
          userId,
          message: error.message,
          stack: error.stack,
        });
        // Continue despite error to avoid blocking the limits response
      }
    }
    elizaLogger.warn("[SUBSCRIPTION_LIMITS] No active subscription or trial", { userId, subscriptionStatus: user.subscriptionStatus });
    throw new Error("No active subscription or trial. Please subscribe to continue.");
  }

  // Handle active trial case
  if (isTrialActive) {
    elizaLogger.debug("[SUBSCRIPTION_LIMITS] User in active trial", { userId, trialEndDate: user.trialEndDate });
    return {
      maxAgents: 2, // Default trial limits
      maxKnowledgeDocsPerAgent: 5,
      maxTotalCharsPerAgent: 10000,
      maxCharsPerKnowledgeDoc: 2000,
    };
  }

  // Handle active subscription case
  if (!user.activePriceIds || user.activePriceIds.length === 0) {
    elizaLogger.warn("[SUBSCRIPTION_LIMITS] No active subscription plan", { userId });
    throw new Error("No active subscription plan found");
  }

  // Find base subscription price ID
  let basePriceId = null;
  for (const id of user.activePriceIds) {
    try {
      const item = await sanityClient.fetch(
        `*[_type == "Item" && stripePriceId == $id && itemType == "base"][0]`,
        { id }
      );
      if (item) {
        basePriceId = id;
        break;
      }
    } catch (error) {
      elizaLogger.warn("[SUBSCRIPTION_LIMITS] Error fetching item for price ID", {
        userId,
        priceId: id,
        message: error.message,
      });
    }
  }

  if (!basePriceId) {
    elizaLogger.warn("[SUBSCRIPTION_LIMITS] No active base subscription", { userId });
    throw new Error("No active base subscription found");
  }

  // Fetch subscription item details
  let subscriptionItem;
  try {
    subscriptionItem = await sanityClient.fetch(
      `*[_type == "Item" && stripePriceId == $priceId][0]{
        maxAgents,
        maxKnowledgeDocsPerAgent,
        maxTotalCharsPerAgent,
        maxCharsPerKnowledgeDoc
      }`,
      { priceId: basePriceId }
    );
  } catch (error) {
    elizaLogger.error("[SUBSCRIPTION_LIMITS] Error fetching subscription item", {
      userId,
      priceId: basePriceId,
      message: error.message,
      stack: error.stack,
    });
    throw new Error("Failed to fetch subscription plan details");
  }

  if (!subscriptionItem) {
    elizaLogger.warn("[SUBSCRIPTION_LIMITS] Subscription plan not found", { userId, priceId: basePriceId });
    throw new Error("Subscription plan not found");
  }

  // Validate returned limits
  const limits = {
    maxAgents: subscriptionItem.maxAgents || 0,
    maxKnowledgeDocsPerAgent: subscriptionItem.maxKnowledgeDocsPerAgent || 0,
    maxTotalCharsPerAgent: subscriptionItem.maxTotalCharsPerAgent || 0,
    maxCharsPerKnowledgeDoc: subscriptionItem.maxCharsPerKnowledgeDoc || undefined,
  };

  if (limits.maxAgents === 0 || limits.maxKnowledgeDocsPerAgent === 0 || limits.maxTotalCharsPerAgent === 0) {
    elizaLogger.warn("[SUBSCRIPTION_LIMITS] Invalid subscription limits", { userId, limits });
    throw new Error("Invalid subscription limits configured");
  }

  elizaLogger.debug("[SUBSCRIPTION_LIMITS] Returning subscription limits", { userId, limits });
  return limits;
}



// Cleanup function for unused products
async function cleanupUnusedProducts(activeItemIds) {
  try {
    elizaLogger.debug("[CLIENT-DIRECT] Running cleanup for unused Stripe products");
    
    // Get all active products from Stripe
    const products = await stripe.products.list({
      limit: 100,
      active: true,
    });
    
    // Filter for products that have sanityItemId but are no longer in our active items
    const productsToArchive = products.data.filter(product => {
      // Only consider products with sanityItemId metadata
      if (!product.metadata || !product.metadata.sanityItemId) {
        return false;
      }
      
      // If the item is not in our active list, mark for archiving
      return !activeItemIds.includes(product.metadata.sanityItemId);
    });
    
    // Archive unused products
    for (const product of productsToArchive) {
      await stripe.products.update(product.id, {
        active: false,
      });
      elizaLogger.debug(`[CLIENT-DIRECT] Archived Stripe product ${product.id} with sanityItemId=${product.metadata.sanityItemId}`);
    }
    
    elizaLogger.debug(`[CLIENT-DIRECT] Archived ${productsToArchive.length} unused Stripe products`);
  } catch (error) {
    // Don't let this error affect the main checkout process
    elizaLogger.error("[CLIENT-DIRECT] Error during product cleanup:", {
      message: error.message,
      stack: error.stack,
    });
  }
}



//   // Helper function to map price IDs to plugin names
// async function getPluginNameFromPriceId(priceId: string): Promise<string | null> {
//   try {
//     const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
//     const product = typeof price.product === 'object' && price.product !== null ? price.product : await stripe.products.retrieve(price.product as string);
//     // Only access metadata if product is not a DeletedProduct
//     if ('metadata' in product && product.metadata) {
//       return product.metadata.pluginName || null;
//     }
//     return null;
//   } catch (error) {
//     elizaLogger.warn(`[CLIENT-DIRECT] Failed to fetch pluginName for priceId=${priceId}`, { error: error.message });
//     return null;
//   }
// }







// // function to check if user has previously had trials
// async function checkTrialEligibility(userId) {
//   try {
//     // First check the Sanity user record
//     const user = await sanityClient.fetch(
//       `*[_type == "User" && userId == $userId][0]`,
//       { userId }
//     );
    
//     // If hasUsedTrial is already set to true in Sanity, user is not eligible
//     if (user && user.hasUsedTrial === true) {
//       return {
//         eligible: false,
//         reason: "User has already used a trial according to our records",
//         trialPeriodDays: null, // Explicitly indicate no trial
//       };
//     }
    
//     // Double-check with Stripe API if there's a customer record
//     if (user && user.stripeCustomerId) {
//       // Get all subscriptions for this customer, including canceled ones
//       const subscriptions = await stripe.subscriptions.list({
//         customer: user.stripeCustomerId,
//         status: 'all',
//         limit: 100,
//       });
      
//       // Check if any previous subscription had a trial
//       const hadTrialBefore = subscriptions.data.some(sub => sub.trial_start);
      
//       if (hadTrialBefore) {
//         // Update Sanity record to reflect this
//         await sanityClient
//           .patch(user._id)
//           .set({ hasUsedTrial: true })
//           .commit();
          
//         return {
//           eligible: false,
//           reason: "User has had a trial in a previous subscription",
//           trialPeriodDays: null, // Explicitly indicate no trial
//         };
//       }
//     }
    
//     // If we get here, user is eligible for trial
//     return {
//       eligible: true,
//       trialPeriodDays: 7, // Default trial period
//     };
//   } catch (error) {
//     elizaLogger.error("[CLIENT-DIRECT] Error checking trial eligibility:", {
//       message: error.message,
//       stack: error.stack,
//       userId,
//     });
    
//     // Default to ineligible in case of errors
//     return {
//       eligible: false,
//       reason: "[CLIENT-DIRECT] Error determining trial eligibility",
//       trialPeriodDays: null, // Explicitly indicate no trial in case of error
//     };
//   }
// }

  


router.post("");





















































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ------------------------User Management Endpoints---------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Helper function to ensure user exists in Sanity
// async function ensureUserInSanity
// Ensures a user exists in Sanity, creating one if necessary, used by other endpoints
async function ensureUserInSanity(clerkId: string) {
  const userId = stringToUuid(clerkId); // Derive deterministic userId
  let user = await sanityClient.fetch(`*[_type == "User" && userId == $userId][0]`, { userId });
  if (!user) {
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    user = await sanityClient.create({
      _type: "User",
      userId,
      trialStartDate: trialStartDate.toISOString(),
      trialEndDate: trialEndDate.toISOString(),
      subscriptionStatus: "trialing",
      responseCount: 0,
      tokenCount: 0,
      currentPeriodStart: trialStartDate.toISOString(),
      currentPeriodEnd: trialEndDate.toISOString(),
      activePlugins: ["chipi", "chipi-client", "zKproof"],
      activePriceIds: [],
      hasUsedTrial: true,
      cancelAtPeriodEnd: false,
    });
    elizaLogger.info("[ENSURE_USER] Created new Sanity user", { userId });
  }
  return user;
}



// Create or update a user in Sanity
// POST /user
// Creates a new user or updates an existing one in Sanity, syncing with Clerk for authentication
router.post("/user", requireAuth, async (req: AuthRequest, res: express.Response) => {
  elizaLogger.debug("[CLIENT-DIRECT] Handling /user POST request");

  const clerkId = req.clerkUserId;
  if (!clerkId) {
    elizaLogger.error("[CLIENT-DIRECT] No clerkUserId provided by middleware");
    return res.status(401).json({ error: "No Clerk user ID provided" });
  }

  const userId = stringToUuid(clerkId); // Derive deterministic userId
  elizaLogger.info("[CLIENT-DIRECT] Authenticated user via middleware", { userId });

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
        elizaLogger.error("[CLIENT-DIRECT] Failed to fetch user after retries:", err);
        return res.status(500).json({ error: "Server error: Failed to fetch user" });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (existingUser) {
    elizaLogger.debug(`[CLIENT-DIRECT] User already exists for userId: ${userId}`);
    return res.status(200).json({
      user: {
        _id: existingUser._id,
        userId: existingUser.userId,
        trialStartDate: existingUser.trialStartDate,
        trialEndDate: existingUser.trialEndDate,
        subscriptionStatus: existingUser.subscriptionStatus || "none",
        responseCount: existingUser.responseCount || 0,
        tokenCount: existingUser.tokenCount || 0,
        currentPeriodStart: existingUser.currentPeriodStart,
        currentPeriodEnd: existingUser.currentPeriodEnd,
        activePlugins: existingUser.activePlugins || [],
        activePriceIds: existingUser.activePriceIds || [],
        stripeCustomerId: existingUser.stripeCustomerId,
        stripeSubscriptionId: existingUser.stripeSubscriptionId,
        hasUsedTrial: existingUser.hasUsedTrial || false,
        cancelAtPeriodEnd: existingUser.cancelAtPeriodEnd || false,
      },
    });
  }

  const trialStartDate = new Date();
  const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const user = await sanityClient.create({
    _type: "User",
    userId,
    trialStartDate: trialStartDate.toISOString(),
    trialEndDate: trialEndDate.toISOString(),
    subscriptionStatus: "trialing",
    responseCount: 0,
    tokenCount: 0,
    currentPeriodStart: trialStartDate.toISOString(),
    currentPeriodEnd: trialEndDate.toISOString(),
    activePlugins: ["chipi", "chipi-client", "zKproof"],
    activePriceIds: [],
    hasUsedTrial: true,
    cancelAtPeriodEnd: false,
  });

  elizaLogger.debug("[CLIENT-DIRECT] Created User:", { userId });
  res.json({
    user: {
      _id: user._id,
      userId: user.userId,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      subscriptionStatus: user.subscriptionStatus,
      responseCount: user.responseCount,
      tokenCount: user.tokenCount,
      currentPeriodStart: user.currentPeriodStart,
      currentPeriodEnd: user.currentPeriodEnd,
      activePlugins: user.activePlugins,
      activePriceIds: user.activePriceIds,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      hasUsedTrial: user.hasUsedTrial,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    },
  });
});


// Clerk webhook to handle user creation events
// POST /webhook/clerk
// Handles Clerk webhooks for user creation, ensuring users are created in Sanity, with signature verification
// Uses raw body parsing for signature verification
router.post("/webhook/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    elizaLogger.error("[WEBHOOK] Missing CLERK_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  try {
    const svixHeaders = {
      "svix-id": req.headers["svix-id"] as string,
      "svix-timestamp": req.headers["svix-timestamp"] as string,
      "svix-signature": req.headers["svix-signature"] as string,
    };

    const wh = new Webhook(webhookSecret);
    const evt = wh.verify(req.body, svixHeaders) as any;

    if (evt.type === "user.created") {
      const { id } = evt.data;
      const clerkId = id;
      const userId = stringToUuid(clerkId); // Derive deterministic userId

      const existingUser = await sanityClient.fetch(
        `*[_type == "User" && userId == $userId][0]`,
        { userId }
      );

      if (existingUser) {
        elizaLogger.info("[CLERK WEBHOOK] User already exists in Sanity", { userId });
      } else {
        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

        const newUser = {
          _type: "User",
          userId,
          trialStartDate: trialStartDate.toISOString(),
          trialEndDate: trialEndDate.toISOString(),
          subscriptionStatus: "trialing",
          responseCount: 0,
          tokenCount: 0,
          currentPeriodStart: trialStartDate.toISOString(),
          currentPeriodEnd: trialEndDate.toISOString(),
          activePlugins: ["chipi", "chipi-client", "zKproof"],
          activePriceIds: [],
          hasUsedTrial: true,
          cancelAtPeriodEnd: false,
        };

        const created = await sanityClient.create(newUser);
        elizaLogger.info("[CLERK WEBHOOK] Created Sanity user", { userId });
      }
    } else {
      elizaLogger.info("[CLERK WEBHOOK] Ignored event type", { type: evt.type });
    }

    res.status(200).json({ success: true });
  } catch (error: any) {
    elizaLogger.error("[CLERK WEBHOOK] Error verifying or processing Clerk webhook", {
      message: error.message,
      stack: error.stack,
    });
    res.status(400).json({ error: "Invalid webhook" });
  }
});





// Retrieve user data
// GET /user
// Fetches user data from Sanity, syncing with Clerk if necessary
router.get("/user", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const clerkId = req.clerkUserId;
    if (!clerkId) {
      elizaLogger.error("[USER_ENDPOINT] No clerkUserId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No Clerk user ID provided" });
    }

    const userId = stringToUuid(clerkId); // Derive deterministic userId
    let user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user) {
      user = await ensureUserInSanity(clerkId);
      elizaLogger.info("[USER_ENDPOINT] Clerk user synced to Sanity", { userId });
    }

    // Check trial status and reset activePlugins if trial has expired
    const now = new Date();
    const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
    const isTrialActive = user.subscriptionStatus === "trialing" && trialEndDate && now <= trialEndDate;
    if (!isTrialActive && user.subscriptionStatus !== "active" && user.activePlugins && user.activePlugins.length > 0) {
      try {
        await sanityClient
          .patch(user._id)
          .set({ activePlugins: [] })
          .commit();
        elizaLogger.info("[USER_ENDPOINT] Reset activePlugins for expired trial", { userId });
        user.activePlugins = []; // Update local user object
      } catch (error) {
        elizaLogger.error("[USER_ENDPOINT] Failed to reset activePlugins", {
          userId,
          message: error.message,
          stack: error.stack,
        });
        // Continue to return user data despite error
      }
    }

    const responseUser = {
      _id: user._id,
      userId: user.userId,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      subscriptionStatus: user.subscriptionStatus || "none",
      responseCount: user.responseCount || 0,
      tokenCount: user.tokenCount || 0,
      currentPeriodStart: user.currentPeriodStart,
      currentPeriodEnd: user.currentPeriodEnd,
      activePlugins: user.activePlugins || [],
      activePriceIds: user.activePriceIds || [],
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      hasUsedTrial: user.hasUsedTrial || false,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd || false,
    };

    res.json({ user: responseUser });
  } catch (error: any) {
    elizaLogger.error("[USER_ENDPOINT] Error fetching user:", {
      userId: req.userId,
      message: error.message,
      stack: error.stack,
    });
    res.status(error.status || 500).json({ error: error.message || "Failed to fetch user data" });
  }
});




// In-memory cache for user stats
// to reduce load on Sanity for frequent requests
let cachedStats: { totalUsers: number; onlineUsers: number; timestamp: number } | null = null;
const cacheDuration = 60 * 1000; // Cache for 1 minute



// Retrieve user statistics
// GET /user-stats
// Fetches total and online user counts, cached for performance
router.get("/user-stats", async (req, res) => {
  try {
    if (cachedStats && Date.now() - cachedStats.timestamp < cacheDuration) {
      elizaLogger.debug("[CLIENT-DIRECT] Using cached user stats", cachedStats);
      return res.json({
        totalUsers: cachedStats.totalUsers,
        onlineUsers: cachedStats.onlineUsers
      });
    }

    const totalUsers = await sanityClient.fetch(
      `count(*[_type == "User"])`
    );

    const onlineUsers = await sanityClient.fetch(
      `count(*[_type == "User" && isConnected == true])`
    );

    cachedStats = { totalUsers, onlineUsers, timestamp: Date.now() };

    elizaLogger.debug("[CLIENT-DIRECT] Fetched user stats", {
      totalUsers,
      onlineUsers
    });

    return res.json({
      totalUsers,
      onlineUsers
    });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching user stats", {
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "Failed to fetch user stats", details: error.message });
  }
});



// Update user connection status
// POST /connection-status
// Updates the user's connection status (isConnected) in Sanity
router.post("/connection-status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { isConnected } = req.body;

    elizaLogger.debug(`[CLIENT-DIRECT] Processing POST /connection-status for userId: ${userId}, isConnected: ${isConnected}`);

    if (typeof isConnected !== "boolean") {
      return res.status(400).json({ error: "isConnected must be a boolean" });
    }

    await sanityClient
      .patch({ query: `*[_type == "User" && userId == $userId][0]`, params: { userId } })
      .set({ isConnected })
      .commit();

    elizaLogger.debug(`[CLIENT-DIRECT] User connection status updated for userId: ${userId}`, { isConnected });
    res.json({ status: "updated", isConnected });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error updating connection status:", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to update connection status" });
  }
});



// Get user connection status
// GET /connection-status
// Retrieves the user's connection status from Sanity
router.get("/connection-status", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    elizaLogger.debug(`[CLIENT-DIRECT] Processing GET /connection-status for userId: ${userId}`);

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]{ userId, isConnected }`,
      { userId }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      isConnected: user.isConnected === true,
      userId: user.userId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error checking connection status:", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to check connection status" });
  }
});



// // GET /user/check (Clerk users auto-synced)
// router.get("/user/check", async (req, res) => {
//   try {
//     const { userId: inputId } = req.query; // Treat as clerkUserId
//     if (!inputId || typeof inputId !== "string") {
//       return res.status(400).json({ error: "userId is required" });
//     }

//     const clerkId = inputId;
//     const user = await sanityClient.fetch(
//       `*[_type == "User" && clerkUserId == $clerkId][0]`,
//       { clerkId }
//     );

//     return res.json({ exists: !!user, user: user || null });
//   } catch (error: any) {
//     elizaLogger.error("[USER_CHECK] Error checking user:", {
//       clerkId: req.query.userId,
//       message: error.message,
//       stack: error.stack,
//     });
//     res.status(500).json({ error: "Failed to check user", details: error.message });
//   }
// });



router.get("");



// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------




























































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ------------------------Character Management Endpoints----------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Create a new character
// POST /characters
// Creates a new character in Sanity, validates plugins and subscription limits, and starts an agent if enabled
// Requires authentication and an active subscription (trial counts), enforced by middleware
// Validates requested plugins against user's activePlugins in Sanity and checks subscription limits
// Ensures character ID and name are unique, and required fields are present
// If 'enabled' is true, starts the agent immediately after creation
// Secrets in settings are handled to ensure they are always defined, even if not provided
// Email plugin secrets are validated if the email plugin is included, ensuring required fields are present
// Encryption of secrets is handled via encryptValue() decryptValue() functions definedin cryptoUtils.ts
// Returns the created character data or appropriate error messages
router.post("/characters", requireAuth, requireActiveSubscription, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for character creation");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }

    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }
    elizaLogger.debug(`[CLIENT-DIRECT] Creating character for user:`, {
      _id: User._id,
      userId: User.userId,
      name: User.name,
    });

    // Validate plugins against activePlugins
    const activePlugins = User.activePlugins || [];
    const { plugins } = req.body;
    if (plugins && Array.isArray(plugins)) {
      const invalidPlugins = plugins.filter(plugin => !activePlugins.includes(plugin));
      if (invalidPlugins.length > 0) {
        return res.status(403).json({
          error: `User does not have active subscriptions for plugins: ${invalidPlugins.join(", ")}`,
        });
      }
    }

    // Check subscription limits
    let limits;
    try {
      limits = await getUserSubscriptionLimits(userId);
    } catch (error) {
      elizaLogger.warn(`[CLIENT-DIRECT] Subscription check failed for userId: ${userId}`, error);
      return res.status(403).json({
        error: "No active subscription or trial. Please subscribe in Settings to create characters.",
      });
    }

    const existingAgentsCount = await sanityClient.fetch(
      `count(*[_type == "character" && createdBy._ref == $userRef])`,
      { userRef: User._id }
    );
    if (existingAgentsCount >= limits.maxAgents) {
      return res.status(403).json({ error: "Maximum number of agents reached for your subscription plan" });
    }

    // Rest of the endpoint logic remains unchanged
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
      settings,
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
    let validatedSettings = settings || {
      secrets: { dynamic: [] },
      ragKnowledge: false,
      voice: { model: "default" },
      email: {
        outgoing: {},
        incoming: {}
      },
      ...settings
    };

    // Ensure secrets is always defined
    if (!validatedSettings.secrets) {
      validatedSettings.secrets = { dynamic: [] };
    }

    // Handle email plugin secrets
  if (plugins && plugins.includes('email')) {
  if (!validatedSettings.email?.outgoing?.service) {
    return res.status(400).json({ error: 'Email outgoing service is required when email plugin is enabled' });
  }
  if (validatedSettings.email.outgoing.service === 'smtp') {
    if (!validatedSettings.email.outgoing.host || !validatedSettings.email.outgoing.port) {
      return res.status(400).json({ error: 'SMTP host and port are required for SMTP service' });
    }
  }
  if (!validatedSettings.email.outgoing.user || !validatedSettings.email.outgoing.pass) {
    return res.status(400).json({ error: 'Email outgoing user and password are required' });
  }
  if (validatedSettings.email.incoming?.service === 'imap') {
    if (!validatedSettings.email.incoming.host || !validatedSettings.email.incoming.port) {
      return res.status(400).json({ error: 'IMAP host and port are required for IMAP service' });
    }
    if (!validatedSettings.email.incoming.user || !validatedSettings.email.incoming.pass) {
      return res.status(400).json({ error: 'IMAP user and password are required' });
    }
  }

      // Filter out existing email-related secrets
      validatedSettings.secrets.dynamic = validatedSettings.secrets.dynamic.filter(
        (item: any) => ![
          'EMAIL_OUTGOING_USER',
          'EMAIL_OUTGOING_PASS',
          'EMAIL_OUTGOING_SERVICE',
          'EMAIL_OUTGOING_HOST',
          'EMAIL_OUTGOING_PORT',
          'EMAIL_SECURE',
          'EMAIL_INCOMING_SERVICE',
          'EMAIL_INCOMING_HOST',
          'EMAIL_INCOMING_PORT',
          'EMAIL_INCOMING_USER',
          'EMAIL_INCOMING_PASS',
        ].includes(item.key)
      );

       // Check if incoming and outgoing credentials are the same
  const isSameCredentials =
    validatedSettings.email?.outgoing?.user === validatedSettings.email?.incoming?.user &&
    validatedSettings.email?.outgoing?.pass === validatedSettings.email?.incoming?.pass;

  // Add email secrets
  if (validatedSettings.email?.outgoing?.user) {
    validatedSettings.secrets.dynamic.push(
      { key: 'EMAIL_OUTGOING_USER', value: validatedSettings.email.outgoing.user },
      { key: 'EMAIL_OUTGOING_PASS', value: validatedSettings.email.outgoing.pass },
      { key: 'EMAIL_OUTGOING_SERVICE', value: validatedSettings.email.outgoing.service }
    );
    if (validatedSettings.email.outgoing.service === 'smtp') {
      validatedSettings.secrets.dynamic.push(
        { key: 'EMAIL_OUTGOING_HOST', value: validatedSettings.email.outgoing.host },
        { key: 'EMAIL_OUTGOING_PORT', value: String(validatedSettings.email.outgoing.port) },
        { key: 'EMAIL_SECURE', value: String(validatedSettings.email.outgoing.secure || false) }
      );
    }
  }

  // Only add incoming secrets if they differ from outgoing or if explicitly provided
  if (validatedSettings.email?.incoming?.user && !isSameCredentials) {
    validatedSettings.secrets.dynamic.push(
      { key: 'EMAIL_INCOMING_SERVICE', value: validatedSettings.email.incoming.service || 'imap' },
      { key: 'EMAIL_INCOMING_HOST', value: validatedSettings.email.incoming.host },
      { key: 'EMAIL_INCOMING_PORT', value: String(validatedSettings.email.incoming.port || 993) },
      { key: 'EMAIL_INCOMING_USER', value: validatedSettings.email.incoming.user },
      { key: 'EMAIL_INCOMING_PASS', value: validatedSettings.email.incoming.pass }
    );
  } else if (isSameCredentials) {
    // Reference outgoing credentials for incoming
    validatedSettings.secrets.dynamic.push(
      { key: 'EMAIL_INCOMING_SERVICE', value: validatedSettings.email.incoming.service || 'imap' },
      { key: 'EMAIL_INCOMING_HOST', value: validatedSettings.email.incoming.host || validatedSettings.email.outgoing.host },
      { key: 'EMAIL_INCOMING_PORT', value: String(validatedSettings.email.incoming.port || 993) },
      { key: 'EMAIL_INCOMING_USER', value: validatedSettings.email.outgoing.user },
      { key: 'EMAIL_INCOMING_PASS', value: validatedSettings.email.outgoing.pass }
    );
  }
}

    // Add duplicate key check within character
if (validatedSettings.secrets.dynamic.length > 0) {
  const secretKeys = validatedSettings.secrets.dynamic.map((item: Secret) => item.key);
  const uniqueKeys = new Set(secretKeys);
  if (uniqueKeys.size !== secretKeys.length) {
    return res.status(400).json({ error: 'Invalid key: Duplicate keys found in secrets' });
  }
}

  // Check for unique key values across characters
    const usedHashes = await getUsedUniqueKeyHashes();
    const newUniqueSecrets = validatedSettings.secrets.dynamic.filter((secret: Secret) => uniqueKeysRequired.includes(secret.key));
    for (const secret of newUniqueSecrets) {
      const hash = computeHash(secret.value!);
      const keyHash = `${secret.key}:${hash}`;
      if (usedHashes.has(keyHash)) {
        return res.status(400).json({ error: `Key ${secret.key} is already used by another character` });
      }
    }

     // Encrypt all secrets before storing
     // and compute hashes for unique keys if needed
    validatedSettings.secrets.dynamic = validatedSettings.secrets.dynamic.map((secret: Secret) => {
      const encrypted = encryptValue(secret.value!);
      return {
        key: secret.key,
        encryptedValue: {
          iv: encrypted.iv,
          ciphertext: encrypted.ciphertext,
        },
        hash: uniqueKeysRequired.includes(secret.key) ? computeHash(secret.value!) : undefined,
      };
    });
    validatedSettings.secrets.dynamic = ensureKeys(validatedSettings.secrets.dynamic);


    const validatedMessageExamples = messageExamples
  ? ensureKeys(
      Array.isArray(messageExamples)
        ? messageExamples.reduce((acc, example, index) => {
            let messages = [];
            // Handle [[{user, content}, ...], ...]
            if (Array.isArray(example)) {
              messages = example.map((msg: any) => ({
                user: typeof msg.user === 'string' && msg.user ? msg.user : '',
                content: {
                  text: typeof msg.content?.text === 'string' && msg.content.text ? msg.content.text : '',
                  action: typeof msg.content?.action === 'string' ? msg.content.action : undefined,
                },
              }));
            }
            // Handle [{ messages: [...] }, ...]
            else if (example.messages && Array.isArray(example.messages)) {
              messages = example.messages.map((msg: any) => ({
                user: typeof msg.user === 'string' && msg.user ? msg.user : '',
                content: {
                  text: typeof msg.content?.text === 'string' && msg.content.text ? msg.content.text : '',
                  action: typeof msg.content?.action === 'string' ? msg.content.action : undefined,
                },
              }));
            }
            // Handle [{user, content}, ...] (flat array case)
            else if (example.user && example.content) {
              messages = [{
                user: typeof example.user === 'string' && example.user ? example.user : '',
                content: {
                  text: typeof example.content?.text === 'string' && example.content.text ? example.content.text : '',
                  action: typeof example.content?.action === 'string' ? example.content.action : undefined,
                },
              }];
            }
            // Only add valid conversations
            if (messages.length > 0) {
              acc.push({ messages: ensureKeys(messages) });
            }
            return acc;
          }, [])
        : []
    )
  : [];
elizaLogger.debug("[CLIENT-DIRECT] req.body.messageExamples:", JSON.stringify(req.body.messageExamples, null, 2));
elizaLogger.debug("[CLIENT-DIRECT] validatedMessageExamples:", JSON.stringify(validatedMessageExamples, null, 2));
    const validatedKnowledge = knowledge
      ? ensureKeys(
          knowledge.map((item: any) =>
            item._type === 'reference' ? item : { ...item, directory: item.directory, shared: item.shared ?? false }
          )
        )
      : [];
    const validatedBio = Array.isArray(bio) ? bio : [];
    const validatedLore = Array.isArray(lore) ? lore : [];
    const validatedPostExamples = Array.isArray(postExamples) ? postExamples : [];
    const validatedTopics = Array.isArray(topics) ? topics : [];
    const validatedAdjectives = Array.isArray(adjectives) ? adjectives : [];
    const validatedStyle = style && typeof style === "object"
      ? {
          all: Array.isArray(style.all) ? style.all : [],
          chat: Array.isArray(style.chat) ? style.chat : [],
          post: Array.isArray(style.post) ? style.post : [],
        }
      : { all: [], chat: [], post: [] };

    const mappedPlugins = await mapSanityPlugins(plugins || []);    


    // Do not populate settings.secrets; let startAgent handle it
    const secrets: { [key: string]: string } = {};

    const characterDoc = {
      _type: "character",
      id,
      name,
      username: username || undefined,
      system: system || "",
      bio: validatedBio,
      lore: validatedLore,
      messageExamples: validatedMessageExamples,
      postExamples: validatedPostExamples,
      topics: validatedTopics,
      adjectives: validatedAdjectives,
      style: validatedStyle,
      modelProvider: validatedModelProvider,
      plugins: plugins || [],
      settings: validatedSettings, // Remove nested settings
      knowledge: validatedKnowledge,
      enabled,
      createdBy: {
        _type: "reference",
        _ref: User._id,
      },
    };
    const createdCharacter = await sanityClient.create(characterDoc);
    elizaLogger.debug(`[CLIENT-DIRECT] Character created:`, {
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
        bio: validatedBio,
        lore: validatedLore,
        messageExamples: validatedMessageExamples.map((conv: any) => conv.messages || []),
        postExamples: validatedPostExamples,
        topics: validatedTopics,
        adjectives: validatedAdjectives,
        style: validatedStyle,
        modelProvider: validatedModelProvider.toLowerCase() as any,
        plugins: mappedPlugins,
        settings: {
          secrets,
          secretsDynamic: validatedSettings.secrets.dynamic,
          ragKnowledge: validatedSettings.ragKnowledge,
          voice: validatedSettings.voice,
          email: validatedSettings.email,
        },
        knowledge: validatedKnowledge,
        createdBy: { _type: "reference", _ref: User._id },
        enabled,
      };
      const agentRuntime = await directClient.startAgent(character);
      directClient.registerAgent(agentRuntime);
      elizaLogger.debug(`[CLIENT-DIRECT] ${name} agent started and registered, agentId: ${agentRuntime.agentId}`);
    } catch (error) {
      elizaLogger.error(`[CLIENT-DIRECT] Failed to start agent:`, {
        message: error.message,
        stack: error.stack,
      });
      await sanityClient.delete(createdCharacter._id);
      return res.status(500).json({ error: "[CLIENT-DIRECT] Failed to start agent", details: error.message });
    }
    res.json({ character: createdCharacter });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error creating character:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to create character", details: error.message });
  }
});



// Retrieve all characters for a user
// GET /characters
// Fetches all characters created by the authenticated user
// Requires authentication and an active subscription (trial counts), enforced by middleware
// Implements retry logic for Sanity fetches to handle transient errors 
// Processes character profiles to include image URLs if available using urlFor  
router.get("/characters", requireAuth, requireActiveSubscription, async (req: AuthRequest, res) => {
  let userId; // Declare userId at the top to ensure it's in scope
  try {
    userId = req.userId; // Use Clerk's userId from middleware
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /characters GET", { userId: null });
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }
    
    elizaLogger.info("[CLIENT-DIRECT] Fetching characters for user", { userId, endpoint: "/characters GET" });

    const maxRetries = 3;
    let user;
    for (let i = 0; i < maxRetries; i++) {
      try {
        user = await sanityClient.fetch(
          `*[_type == "User" && userId == $userId][0]`,
          { userId }
        );
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to fetch user after retries", {
            userId,
            endpoint: "/characters GET",
            message: error.message,
            stack: error.stack,
          });
          return res.status(500).json({ error: "[CLIENT-DIRECT] Server error: Failed to fetch user data" });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!user) {
      elizaLogger.warn("[CLIENT-DIRECT] No User found for userId", { userId, endpoint: "/characters GET" });
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    elizaLogger.info("[CLIENT-DIRECT] User found", { 
      userId, 
      sanityUserId: user._id,
      endpoint: "/characters GET" 
    });

    const query = `
      *[_type == "character" && createdBy._ref == $userId] {
        _id,
        id,
        name,
        username,
        system,
        bio,
        lore,
        topics,
        adjectives,
        postExamples,
        messageExamples,
        modelProvider,
        plugins,
        settings,
        style,
        knowledge,
        enabled,
        profile {
          image
        }
      }
    `;
    let agents;
    for (let i = 0; i < maxRetries; i++) {
      try {
        agents = await sanityClient.fetch(query, { userId: user._id });
        break;
      } catch (error) {
        if (i === maxRetries - 1) {
          elizaLogger.error("[CLIENT-DIRECT] Failed to fetch characters after retries", {
            userId,
            endpoint: "/characters GET",
            message: error.message,
            stack: error.stack,
          });
          return res.status(500).json({ error: "[CLIENT-DIRECT] Server error: Failed to fetch characters" });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    elizaLogger.info("[CLIENT-DIRECT] Characters fetched", { 
      userId,
      characterCount: agents.length,
      characterIds: agents.map(agent => agent.id),
      endpoint: "/characters GET"
    });

    const processedAgents = agents.map(agent => ({
      ...agent,
      profile: agent.profile?.image
        ? { image: urlFor(agent.profile.image).url() }
        : undefined,
    }));

    elizaLogger.info("[CLIENT-DIRECT] Characters processed", { 
      userId,
      characterCount: processedAgents.length,
      endpoint: "/characters GET"
    });

    res.json({ agents: processedAgents });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching characters", { 
      userId: userId || null,
      endpoint: "/characters GET",
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch characters", details: error.message });
  }
});



// Retrieve a specific character
// GET /characters/:characterId
// Fetches a specific character by ID, ensuring it belongs to the user and processing profile images if available
// Requires authentication and an active subscription (trial counts), enforced by middleware
// Processes character profile to include image URL using urlFor if an image is set
router.get("/characters/:characterId", async (req, res) => {
  let userId; // Declare userId at the top to ensure it's in scope
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    userId = session.getUserId();
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in session", { userId: null });
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found in session" });
    }

    elizaLogger.info("[CLIENT-DIRECT] Fetching character", { 
      userId, 
      characterId: req.params.characterId 
    });

    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn("[CLIENT-DIRECT] No User found for userId", { userId });
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    elizaLogger.info("[CLIENT-DIRECT] User found for character fetch", { 
      userId, 
      sanityUserId: User._id 
    });

    const { characterId } = req.params;
    if (!validateUuid(characterId)) {
      elizaLogger.warn("[CLIENT-DIRECT] Invalid characterId format", { 
        userId, 
        characterId 
      });
      return res.status(400).json({
        error: "Invalid characterId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      });
    }

    const query = `
      *[_type == "character" && id == $characterId && createdBy._ref == $userRef][0] {
        _id,
        id,
        name,
        username,
        system,
        bio,
        lore,
        topics,
        adjectives,
        postExamples,
        messageExamples,
        modelProvider,
        plugins,
        settings,
        style,
        knowledge,
        enabled,
        profile {
          image
        }
      }
    `;
    const character = await sanityClient.fetch(query, { characterId, userRef: User._id });

    if (!character) {
      elizaLogger.warn("[CLIENT-DIRECT] Character not found", { 
        userId, 
        characterId, 
        userRef: User._id 
      });
      return res.status(404).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }

    elizaLogger.info("[CLIENT-DIRECT] Character fetched", { 
      userId, 
      characterId, 
      characterName: character.name,
      characterUsername: character.username
    });

    const processedCharacter = {
      ...character,
      profile: character.profile?.image
        ? { image: urlFor(character.profile.image).url() }
        : undefined,
    };

    elizaLogger.info("[CLIENT-DIRECT] Character processed", { 
      userId, 
      characterId, 
      hasProfileImage: !!processedCharacter.profile?.image 
    });

    res.json({ character: processedCharacter });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching character", { 
      userId: userId || null, // Fallback to null if userId is undefined
      characterId: req.params.characterId, 
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch character", details: error.message });
  }
});



// Update a character
// PATCH /characters/:characterId
// Updates a character's details, validates plugins and secrets, and restarts the agent
router.patch("/characters/:characterId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    const { characterId } = req.params;

    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    // Validate plugins against activePlugins
    const activePlugins = User.activePlugins || [];
    const { plugins } = req.body;
    if (plugins && Array.isArray(plugins)) {
      const invalidPlugins = plugins.filter(plugin => !activePlugins.includes(plugin));
      if (invalidPlugins.length > 0) {
        return res.status(403).json({
          error: `User does not have active subscriptions for plugins: ${invalidPlugins.join(", ")}`,
        });
      }
    }

    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for characterId: ${characterId} and userRef: ${User._id}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
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
      settings,
      knowledge,
      enabled,
      plugins: updatedPlugins
    } = req.body;

    // Validate input
    if (
      !name &&
      !username &&
      !system &&
      !bio &&
      !lore &&
      messageExamples === undefined &&
      !postExamples &&
      !topics &&
      !adjectives &&
      !style &&
      !modelProvider &&
      !settings &&
      !knowledge &&
      enabled === undefined &&
      !updatedPlugins
    ) {
      return res.status(400).json({ error: "At least one field is required to update" });
    }

    // Validate fields
    if (name && typeof name !== 'string') {
      return res.status(400).json({ error: "Name must be a string" });
    }
    if (name) {
      const existingName = await sanityClient.fetch(
        `*[_type == "character" && name == $name && _id != $characterId][0]`,
        { name, characterId: character._id }
      );
      if (existingName) {
        return res.status(400).json({ error: "Character name already exists" });
      }
    }
    if (username && typeof username !== 'string') {
      return res.status(400).json({ error: "Username must be a string" });
    }
    if (username) {
      const existingUsername = await sanityClient.fetch(
        `*[_type == "character" && username == $username && _id != $characterId][0]`,
        { username, characterId: character._id }
      );
      if (existingUsername) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    const validModelProviders = ["OPENAI", "OLLAMA", "CUSTOM"];
    const validatedModelProvider = modelProvider && validModelProviders.includes(modelProvider)
      ? modelProvider
      : character.modelProvider;

    // Validate and transform messageExamples
    let validatedMessageExamples = character.messageExamples;
    if (messageExamples !== undefined) {
      validatedMessageExamples = Array.isArray(messageExamples)
        ? messageExamples.reduce((acc, example, index) => {
            let messages = [];
            if (Array.isArray(example)) {
              messages = example.map((msg) => ({
                user: typeof msg.user === 'string' && msg.user ? msg.user : '',
                content: {
                  text: typeof msg.content?.text === 'string' && msg.content.text ? msg.content.text : '',
                  action: typeof msg.content?.action === 'string' ? msg.content.action : undefined,
                },
              }));
            } else if (example.messages && Array.isArray(example.messages)) {
              messages = example.messages.map((msg) => ({
                user: typeof msg.user === 'string' && msg.user ? msg.user : '',
                content: {
                  text: typeof msg.content?.text === 'string' && msg.content.text ? msg.content.text : '',
                  action: typeof msg.content?.action === 'string' ? msg.content.action : undefined,
                },
              }));
            } else if (example.user && example.content) {
              messages = [{
                user: typeof example.user === 'string' && example.user ? example.user : '',
                content: {
                  text: typeof example.content?.text === 'string' && example.content.text ? example.content.text : '',
                  action: typeof example.content?.action === 'string' ? example.content.action : undefined,
                },
              }];
            }
            if (messages.length > 0) {
              acc.push({
                _key: example._key || character.messageExamples[index]?._key || crypto.randomUUID(),
                messages: ensureKeys(messages)
              });
            }
            return acc;
          }, [])
        : [];
      elizaLogger.debug("[CLIENT-DIRECT] validatedMessageExamples:", JSON.stringify(validatedMessageExamples, null, 2));
    }

    // Validate other fields
    const validatedBio = bio ? (Array.isArray(bio) ? bio : []) : character.bio;
    const validatedLore = lore ? (Array.isArray(lore) ? lore : []) : character.lore;
    const validatedPostExamples = postExamples ? (Array.isArray(postExamples) ? postExamples : []) : character.postExamples;
    const validatedTopics = topics ? (Array.isArray(topics) ? topics : []) : character.topics;
    const validatedAdjectives = adjectives ? (Array.isArray(adjectives) ? adjectives : []) : character.adjectives;
    const validatedStyle = style && typeof style === "object"
      ? {
          all: Array.isArray(style.all) ? style.all : character.style?.all || [],
          chat: Array.isArray(style.chat) ? style.chat : character.style?.chat || [],
          post: Array.isArray(style.post) ? style.post : character.style?.post || [],
        }
      : character.style;
    const validatedKnowledge = knowledge
      ? ensureKeys(
          knowledge.map((item) =>
            item._type === 'reference' ? item : { ...item, directory: item.directory, shared: item.shared ?? false }
          )
        )
      : character.knowledge;

    // Initialize validatedSettings, preserving existing settings
    let validatedSettings = { ...character.settings, ...settings };
    if (!validatedSettings.secrets || typeof validatedSettings.secrets !== "object") {
      elizaLogger.debug("[CLIENT-DIRECT] Initializing validatedSettings.secrets as { dynamic: [] } in PATCH");
      validatedSettings.secrets = { dynamic: [] };
    }
    if (!Array.isArray(validatedSettings.secrets.dynamic)) {
      elizaLogger.debug("[CLIENT-DIRECT] Setting validatedSettings.secrets.dynamic to [] in PATCH");
      validatedSettings.secrets.dynamic = [];
    }

    // Handle email plugin secrets, preserving existing secrets if not updated
    if (updatedPlugins && updatedPlugins.includes("email")) {
      if (!validatedSettings.email?.outgoing?.service) {
        return res.status(400).json({ error: "Email outgoing service is required when email plugin is enabled" });
      }
      if (validatedSettings.email.outgoing.service === "smtp") {
        if (!validatedSettings.email.outgoing.host || !validatedSettings.email.outgoing.port) {
          return res.status(400).json({ error: "SMTP host and port are required for SMTP service" });
        }
      }
      // Only validate user/pass if provided in the update
      if (settings?.email?.outgoing?.user || settings?.email?.outgoing?.pass) {
        if (!validatedSettings.email.outgoing.user || !validatedSettings.email.outgoing.pass) {
          return res.status(400).json({ error: "Email outgoing user and password are required when updating email settings" });
        }
      }
      if (validatedSettings.email.incoming?.service === "imap") {
        if (!validatedSettings.email.incoming.host || !validatedSettings.email.incoming.port) {
          return res.status(400).json({ error: "IMAP host and port are required for IMAP service" });
        }
        // Only validate incoming user/pass if provided
        if (settings?.email?.incoming?.user || settings?.email?.incoming?.pass) {
          if (!validatedSettings.email.incoming.user || !validatedSettings.email.incoming.pass) {
            return res.status(400).json({ error: "IMAP user and password are required when updating incoming email settings" });
          }
        }
      }

      // Preserve existing secrets if not updated
      let existingSecrets = character.settings.secrets?.dynamic || [];
      validatedSettings.secrets.dynamic = existingSecrets.filter(
        (item) => ![
          "EMAIL_OUTGOING_SERVICE",
          "EMAIL_OUTGOING_HOST",
          "EMAIL_OUTGOING_PORT",
          "EMAIL_OUTGOING_USER",
          "EMAIL_OUTGOING_PASS",
          "EMAIL_SECURE",
          "EMAIL_INCOMING_SERVICE",
          "EMAIL_INCOMING_HOST",
          "EMAIL_INCOMING_PORT",
          "EMAIL_INCOMING_USER",
          "EMAIL_INCOMING_PASS"
        ].includes(item.key)
      );

      // Check if incoming and outgoing credentials are the same
      const isSameCredentials =
        validatedSettings.email?.outgoing?.user === validatedSettings.email?.incoming?.user &&
        validatedSettings.email?.outgoing?.pass === validatedSettings.email?.incoming?.pass;

      if (validatedSettings.email?.outgoing?.user) {
        validatedSettings.secrets.dynamic.push(
          { key: "EMAIL_OUTGOING_USER", value: validatedSettings.email.outgoing.user },
          { key: "EMAIL_OUTGOING_PASS", value: validatedSettings.email.outgoing.pass },
          { key: "EMAIL_OUTGOING_SERVICE", value: validatedSettings.email.outgoing.service }
        );
        if (validatedSettings.email.outgoing.service === "smtp") {
          validatedSettings.secrets.dynamic.push(
            { key: "EMAIL_OUTGOING_HOST", value: validatedSettings.email.outgoing.host },
            { key: "EMAIL_OUTGOING_PORT", value: String(validatedSettings.email.outgoing.port) },
            { key: "EMAIL_SECURE", value: String(validatedSettings.email.outgoing.secure || true) }
          );
        }
      }

      if (validatedSettings.email?.incoming?.user && !isSameCredentials) {
        validatedSettings.secrets.dynamic.push(
          { key: "EMAIL_INCOMING_SERVICE", value: validatedSettings.email.incoming.service || "imap" },
          { key: "EMAIL_INCOMING_HOST", value: validatedSettings.email.incoming.host },
          { key: "EMAIL_INCOMING_PORT", value: String(validatedSettings.email.incoming.port || 993) },
          { key: "EMAIL_INCOMING_USER", value: validatedSettings.email.incoming.user },
          { key: "EMAIL_INCOMING_PASS", value: validatedSettings.email.incoming.pass }
        );
      } else if (isSameCredentials) {
        validatedSettings.secrets.dynamic.push(
          { key: "EMAIL_INCOMING_SERVICE", value: validatedSettings.email.incoming.service || "imap" },
          { key: "EMAIL_INCOMING_HOST", value: validatedSettings.email.incoming.host || validatedSettings.email.outgoing.host },
          { key: "EMAIL_INCOMING_PORT", value: String(validatedSettings.email.incoming.port || 993) },
          { key: "EMAIL_INCOMING_USER", value: validatedSettings.email.outgoing.user },
          { key: "EMAIL_INCOMING_PASS", value: validatedSettings.email.outgoing.pass }
        );
      }

      // Log secrets for debugging
      elizaLogger.debug("[CLIENT-DIRECT] Secrets after processing:", validatedSettings.secrets.dynamic);
    }

    // Duplicate key check within character
    if (settings && settings.secrets && settings.secrets.dynamic && settings.secrets.dynamic.length > 0) {
      const secretKeys = settings.secrets.dynamic.map((item: Secret) => item.key);
      const uniqueKeys = new Set(secretKeys);
      if (uniqueKeys.size !== secretKeys.length) {
        return res.status(400).json({ error: 'Invalid key: Duplicate keys found in secrets' });
      }
    }

    // Check for unique key values across characters
    const usedHashes = await getUsedUniqueKeyHashes(character._id);
    const updatedUniqueSecrets = validatedSettings.secrets.dynamic.filter((secret: Secret) => uniqueKeysRequired.includes(secret.key));
    for (const secret of updatedUniqueSecrets) {
      const hash = computeHash(secret.value!);
      const keyHash = `${secret.key}:${hash}`;
      if (usedHashes.has(keyHash)) {
        return res.status(400).json({ error: `Key ${secret.key} is already used by another character` });
      }
    }

    // Encrypt all secrets
    validatedSettings.secrets.dynamic = validatedSettings.secrets.dynamic.map((secret: Secret) => {
      if (!secret.value) {
        // Preserve existing encrypted secret if no new value provided
        const existingSecret = character.settings.secrets?.dynamic?.find(s => s.key === secret.key);
        if (existingSecret) {
          return existingSecret;
        }
        elizaLogger.warn(`[CLIENT-DIRECT] No value provided for secret ${secret.key}, skipping encryption`);
        return secret;
      }
      const encrypted = encryptValue(secret.value);
      return {
        key: secret.key,
        encryptedValue: { iv: encrypted.iv, ciphertext: encrypted.ciphertext },
        hash: uniqueKeysRequired.includes(secret.key) ? computeHash(secret.value) : undefined,
      };
    });
    validatedSettings.secrets.dynamic = ensureKeys(validatedSettings.secrets.dynamic);

    // Construct update fields
    const updateFields = {
      ...(name && { name }),
      ...(username && { username }),
      ...(system && { system }),
      ...(bio && { bio: validatedBio }),
      ...(lore && { lore: validatedLore }),
      ...(messageExamples !== undefined && { messageExamples: validatedMessageExamples }),
      ...(postExamples && { postExamples: validatedPostExamples }),
      ...(topics && { topics: validatedTopics }),
      ...(adjectives && { adjectives: validatedAdjectives }),
      ...(style && { style: validatedStyle }),
      ...(knowledge && { knowledge: validatedKnowledge }),
      ...(settings && { settings: validatedSettings }),
      ...(enabled !== undefined && { enabled }),
      ...(updatedPlugins && { plugins: updatedPlugins }),
      ...(modelProvider && { modelProvider: validatedModelProvider }),
      updatedAt: new Date().toISOString(),
    };

    // Update character in Sanity
    const updatedCharacter = await sanityClient
      .patch(character._id)
      .set(updateFields)
      .commit();
    elizaLogger.debug(`[CLIENT-DIRECT] Updated character in Sanity: characterId=${characterId}, name=${updatedCharacter.name}`);

    // Map plugins to Plugin objects
    const mappedPlugins = await mapSanityPlugins(updatedCharacter.plugins || []);

    const requiredSecrets = {
      twitter: ['TWITTER_USERNAME', 'TWITTER_PASSWORD'],
      telegram: ['TELEGRAM_BOT_TOKEN'],
      email: ['EMAIL_OUTGOING_USER', 'EMAIL_OUTGOING_PASS'],
    };
    for (const plugin of mappedPlugins) {
      const neededKeys = requiredSecrets[plugin.name];
      if (neededKeys) {
        for (const key of neededKeys) {
          const secretExists = validatedSettings.secrets.dynamic.some((item: Secret) => item.key === key);
          if (!secretExists) {
            elizaLogger.warn(
              `[CLIENT-DIRECT] Missing secret ${key} for plugin ${plugin.name} in character ${updatedCharacter.name}`
            );
          }
        }
      }
    }

    // Construct full Character object for runtime
    const validatedBioFinal = Array.isArray(updatedCharacter.bio) ? updatedCharacter.bio : [];
    const validatedLoreFinal = Array.isArray(updatedCharacter.lore) ? updatedCharacter.lore : [];
    const validatedMessageExamplesFinal = Array.isArray(updatedCharacter.messageExamples) ? updatedCharacter.messageExamples : [];
    const validatedPostExamplesFinal = Array.isArray(updatedCharacter.postExamples) ? updatedCharacter.postExamples : [];
    const validatedTopicsFinal = Array.isArray(updatedCharacter.topics) ? updatedCharacter.topics : [];
    const validatedAdjectivesFinal = Array.isArray(updatedCharacter.adjectives) ? updatedCharacter.adjectives : [];
    const validatedStyleFinal = updatedCharacter.style && typeof updatedCharacter.style === "object"
      ? {
          all: Array.isArray(updatedCharacter.style.all) ? updatedCharacter.style.all : [],
          chat: Array.isArray(updatedCharacter.style.chat) ? updatedCharacter.style.chat : [],
          post: Array.isArray(updatedCharacter.style.post) ? updatedCharacter.style.post : [],
        }
      : { all: [], chat: [], post: [] };

    const characterData = {
      id: validateUuid(characterId) ? characterId : (() => { throw new Error("Invalid UUID format for characterId"); })(),
      name: updatedCharacter.name,
      username: updatedCharacter.username || updatedCharacter.name,
      system: updatedCharacter.system || "",
      bio: validatedBioFinal,
      lore: validatedLoreFinal,
      messageExamples: validatedMessageExamplesFinal.map((conv) => conv.messages || []),
      postExamples: validatedPostExamplesFinal,
      topics: validatedTopicsFinal,
      adjectives: validatedAdjectivesFinal,
      style: validatedStyleFinal,
      modelProvider: validatedModelProvider.toLowerCase(),
      plugins: mappedPlugins,
      settings: {
        ...updatedCharacter.settings,
        secrets: {}, // Empty object, consistent with router.post
        secretsDynamic: updatedCharacter.settings.secrets?.dynamic || [], // Rename to secretsDynamic
      },
      knowledge: updatedCharacter.knowledge || [],
      profile: updatedCharacter.profile || undefined,
      createdBy: {
        _type: "reference",
        _ref: User._id,
      },
      enabled: updatedCharacter.enabled ?? true,
    };

    // Log characterData for debugging
    elizaLogger.debug("[CLIENT-DIRECT] characterData for startAgent:", {
      characterId,
      secretsDynamic: characterData.settings.secrets.dynamic,
    });

    // Stop and unregister existing agent
    try {
      const agent = agents.get(characterId);
      if (agent) {
        agent.stop();
        directClient.unregisterAgent(agent);
        agents.delete(characterId);
        elizaLogger.debug(`[CLIENT-DIRECT] Stopped and unregistered agent for characterId=${characterId}`);
      }
    } catch (error) {
      elizaLogger.warn(`[CLIENT-DIRECT] Error stopping existing agent for characterId=${characterId}:`, error);
    }

    // Start new agent
    try {
      const newAgent = await directClient.startAgent(characterData);
      agents.set(characterId, newAgent);
      directClient.registerAgent(newAgent);
      elizaLogger.debug(`[CLIENT-DIRECT] Started and registered new agent for characterId=${characterId}, agentId=${newAgent.agentId}`);
    } catch (error) {
      elizaLogger.error(`[CLIENT-DIRECT] Failed to start agent for characterId=${characterId}:`, {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({ error: "[CLIENT-DIRECT] Failed to initialize agent after update", details: error.message });
    }

    res.json({ character: updatedCharacter });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error updating character:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to update character", details: error.message });
  }
});



// Delete a character
// DELETE /characters/:characterId
// Deletes a character and its associated knowledge items, stopping the agent
router.delete("/characters/:characterId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    const { characterId } = req.params;

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    // Validate that the character exists and belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for characterId: ${characterId} and userRef: ${User._id}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }

    // Delete associated knowledge items
    const knowledgeItems = await sanityClient.fetch(
      `*[_type == "knowledge" && agentId == $characterId]`,
      { characterId }
    );
    for (const knowledge of knowledgeItems) {
      await sanityClient.delete(knowledge._id);
      elizaLogger.debug(`[CLIENT-DIRECT] Deleted knowledge item: knowledgeId=${knowledge.id}, characterId=${characterId}`);
    }

    // Delete character from Sanity
    await sanityClient.delete(character._id);
    elizaLogger.debug(`[CLIENT-DIRECT] Deleted character: characterId=${characterId}, name=${character.name}`);

    // Stop and unregister the agent
    const agent = agents.get(characterId);
    if (agent) {
      agent.stop();
      directClient.unregisterAgent(agent);
      elizaLogger.debug(`[CLIENT-DIRECT] Agent stopped and unregistered for characterId=${characterId}`);
    }

    res.status(204).end();
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error deleting character:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to delete character", details: error.message });
  }
});



// Check for duplicate secrets
// POST /check-duplicate-secrets
// Validates that secret values (e.g., email credentials) are unique across characters
router.post('/check-duplicate-secrets', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    if (!userId) {
      elizaLogger.warn('[CLIENT-DIRECT] No userId found in request for duplicate check');
      return res.status(401).json({ error: '[CLIENT-DIRECT] Unauthorized: No user ID found' });
    }

    const { secrets, characterId } = req.body;
    if (!secrets || !Array.isArray(secrets)) {
      return res.status(400).json({ error: 'Secrets must be an array of { key, value } objects' });
    }

    const usedHashes = await getUsedUniqueKeyHashes(characterId || null);
    const duplicates: { key: string; value: string }[] = [];

    for (const secret of secrets) {
      if (uniqueKeysRequired.includes(secret.key)) {
        const hash = computeHash(secret.value);
        const keyHash = `${secret.key}:${hash}`;
        if (usedHashes.has(keyHash)) {
          duplicates.push({ key: secret.key, value: secret.value });
        }
      }
    }

    if (duplicates.length > 0) {
      return res.status(400).json({
        error: 'Duplicate secret values found',
        duplicates,
      });
    }

    res.json({ valid: true });
  } catch (error) {
    elizaLogger.error('[CLIENT-DIRECT] Error checking duplicates:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: '[CLIENT-DIRECT] Failed to check duplicates', details: error.message });
  }
});



// Helper function to map Sanity plugins to runtime plugins
// async function mapSanityPlugins
// Maps Sanity plugin data to runtime Plugin objects for agent initialization
async function mapSanityPlugins(plugins: any[]): Promise<Plugin[]> {
  const pluginPromises = plugins.map(async (plugin: any): Promise<Plugin | undefined> => {
    try {
      let pluginName: string;
      let pluginConfig: any = {};
      if (typeof plugin === "string") {
        pluginName = plugin;
      } else if (typeof plugin === "object" && plugin?.name) {
        pluginName = plugin.name;
        pluginConfig = plugin;
      } else {
        elizaLogger.warn(`[CLIENT-DIRECT] Invalid plugin format:`, plugin);
        return undefined;
      }

      let pluginModule;
      switch (pluginName) {
        case "telegram":
          try {
            pluginModule = await import("@elizaos-plugins/client-telegram");
            if (!pluginModule.default && !pluginModule.telegramPlugin) {
              elizaLogger.error(`[CLIENT-DIRECT] Plugin ${pluginName} has no valid default or named (telegramPlugin) export`);
              return undefined;
            }
            return {
              name: "telegram",
              description: pluginConfig.description || "Telegram client plugin",
              clients: pluginConfig.clients || (pluginModule.default?.clients || pluginModule.telegramPlugin?.clients) || [],
              actions: pluginConfig.actions || (pluginModule.default?.actions || pluginModule.telegramPlugin?.actions) || [],
            };
          } catch (error) {
            elizaLogger.error(`[Client-Direct] Failed to import plugin ${pluginName}:`, {
              message: error.message,
              stack: error.stack,
            });
            return undefined;
          }
        case "twitter":
          try {
            pluginModule = await import("@elizaos-plugins/plugin-twitter");
            if (!pluginModule.default && !pluginModule.twitterPlugin) {
              elizaLogger.error(`[CLIENT-DIRECT] Plugin ${pluginName} has no valid default or named (twitterPlugin) export`);
              return undefined;
            }
            return {
              name: "twitter",
              description: pluginConfig.description || "Twitter plugin",
              actions: pluginConfig.actions || (pluginModule.default?.actions || pluginModule.twitterPlugin?.actions) || [],
              services: pluginModule.default?.services || [],
            };
          } catch (error) {
            elizaLogger.error(`[Client-Direct] Failed to import plugin ${pluginName}:`, {
              message: error.message,
              stack: error.stack,
            });
            return undefined;
          }
        case "email":
          try {
            pluginModule = await import("@elizaos-plugins/plugin-email");
            if (!pluginModule.default && !pluginModule.emailPlugin) {
              elizaLogger.error(`[CLIENT-DIRECT] Plugin ${pluginName} has no valid default or named (emailPlugin) export`);
              return undefined;
            }
            return {
              name: "email",
              description: pluginConfig.description || "Email client plugin",
              clients: pluginConfig.clients || (pluginModule.default?.clients || pluginModule.emailPlugin?.clients) || [],
              actions: pluginConfig.actions || pluginModule.default?.actions || [],
            };
          } catch (error) {
            elizaLogger.error(`[Client-Direct] Failed to import plugin ${pluginName}:`, {
              message: error.message,
              stack: error.stack,
            });
            return undefined;
          }
        case "chipi":
          try {
            pluginModule = await import("@elizaos-plugins/plugin-chipi");
            if (!pluginModule.default && !pluginModule.chipiPlugin) {
              elizaLogger.error(`[CLIENT-DIRECT] Plugin ${pluginName} has no valid default or named (chipiPlugin) export`);
              return undefined;
            }
            return {
              name: "chipi",
              description: pluginConfig.description || "Chipi client plugin",
              clients: pluginConfig.clients || (pluginModule.default?.clients || pluginModule.chipiPlugin?.clients) || [],
              actions: pluginConfig.actions || pluginModule.default?.actions || [],
            };
          } catch (error) {
            elizaLogger.error(`[Client-Direct] Failed to import plugin ${pluginName}:`, {
              message: error.message,
              stack: error.stack,
            });
            return undefined;
          }
          case "chipiclient":
          try {
            pluginModule = await import("@elizaos-plugins/plugin-chipi-client");
            if (!pluginModule.default && !pluginModule.chipiClientPlugin) {
              elizaLogger.error(`[CLIENT-DIRECT] Plugin ${pluginName} has no valid default or named (chipiPlugin) export`);
              return undefined;
            }
            return {
              name: "chipiclient",
              description: pluginConfig.description || "Chipi client plugin",
              clients: pluginConfig.clients || (pluginModule.default?.clients || pluginModule.chipiClientPlugin?.clients) || [],
              actions: pluginConfig.actions || pluginModule.default?.actions || [],
            };
          } catch (error) {
            elizaLogger.error(`[Client-Direct] Failed to import plugin ${pluginName}:`, {
              message: error.message,
              stack: error.stack,
            });
            return undefined;
          }
          case "zKproof":
          try {
            pluginModule = await import("@elizaos-plugins/plugin-zkproof");
            if (!pluginModule.default && !pluginModule.zKproofPlugin) {
              elizaLogger.error(`[CLIENT-DIRECT] Plugin ${pluginName} has no valid default or named (zKproofPlugin) export`);
              return undefined;
            }
            return {
              name: "zKproof",
              description: pluginConfig.description || "ZK Proof client plugin",
              clients: pluginConfig.clients || (pluginModule.default?.clients || pluginModule.zKproofPlugin?.clients) || [],
              actions: pluginConfig.actions || pluginModule.default?.actions || [],
            };
          } catch (error) {
            elizaLogger.error(`[Client-Direct] Failed to import plugin ${pluginName}:`, {
              message: error.message,
              stack: error.stack,
            });
            return undefined;
          }
        default:
          elizaLogger.warn(`[CLIENT-DIRECT] Unknown plugin: ${pluginName}`);
          return undefined;
      }
    } catch (error) {
      elizaLogger.error(`[CLIENT-DIRECT] Unexpected error processing plugin ${plugin}:`, {
        message: error.message,
        stack: error.stack,
      });
      return undefined;
    }
  });

  const mappedPlugins = (await Promise.all(pluginPromises)).filter(
    (plugin): plugin is Plugin => plugin !== undefined
  );
  return mappedPlugins;
}


// Retrieve character presets
// GET /character-presets
// Fetches predefined character presets from Sanity for use as templates
router.get("/character-presets", async (req, res) => {
  try {
    const query = `*[_type == "characterPreset"] {
      _id,
      name,
      username,
      system,
      bio,
      lore,
      messageExamples[] {
        conversation[] {
          user,
          content { text }
        }
      },
      postExamples,
      topics,
      adjectives,
      style {
        all,
        chat,
        post
      },
      modelProvider,
      plugins,
      settings {
        ragKnowledge,
        secrets { dynamic }
      },
      knowledge[]-> {
        _id,
        title
      }
    }`;

    const characterPresets = await sanityClient.fetch(query);

    if (!characterPresets || characterPresets.length === 0) {
      elizaLogger.warn("[CLIENT-DIRECT] No character presets found in Sanity");
      return res.status(404).json({ error: "[CLIENT-DIRECT] No character presets found" });
    }

    elizaLogger.debug("[CLIENT-DIRECT] Fetched character presets from Sanity", {
      count: characterPresets.length,
    });

    res.json({ characterPresets });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching character presets:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch character presets", details: error.message });
  }
});



// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------























































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// --------------------------Agent Operations Endpoints------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Retrieve all agents for a user
// GET /agents
// Fetches all active agents (characters with running runtimes) for the user
router.get("/agents", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Sanity UUID from requireAuth middleware
    if (!userId) {
      elizaLogger.error("[CLIENT-DIRECT] No userId provided by middleware");
      return res.status(401).json({ error: "Unauthorized: No user ID provided" });
    }

    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );

    if (!user) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "User not found in Sanity" });
    }

    const now = new Date();
    const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
    const isTrialActive = trialEndDate && now <= trialEndDate;
    const isSubscribed = user.subscriptionStatus === "active";

    if (!isTrialActive && !isSubscribed) {
      elizaLogger.info("[CLIENT-DIRECT] Access denied: Trial expired or no subscription", {
        userId,
      });
      return res.status(403).json({ error: "Trial Expired" });
    }

    const characters = await sanityClient.fetch(
      `*[_type == "character" && createdBy._ref == $userRef && enabled == true]{
        id,
        _id,
        name,
        username,
        bio,
        enabled,
        createdBy,
        profile {
          image
        }
      }`,
      { userRef: user._id }
    );

    const agentsList = Array.from(agents.values())
      .filter((agent) => {
        const matchingChar = characters.find((char: any) => char.id === agent.agentId && char.enabled);
        if (!matchingChar) {
          elizaLogger.debug(`[CLIENT-DIRECT] No matching character found for agentId: ${agent.agentId}, name: ${agent.character.name}`);
        }
        return !!matchingChar;
      })
      .map((agent) => {
        const character = characters.find((char: any) => char.id === agent.agentId);
        return {
          id: agent.agentId,
          name: agent.character.name,
          username: character?.username,
          bio: character?.bio || [],
          clients: Object.keys(agent.clients),
          profile: character?.profile?.image
            ? { image: urlFor(character.profile.image).url() }
            : undefined,
        };
      });

    elizaLogger.debug(`[CLIENT-DIRECT] Filtered agents for user ${userId}:`, {
      count: agentsList.length,
      agents: agentsList,
    });
    res.json({ agents: agentsList });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching agents", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch agents", details: error.message });
  }
});



// Retrieve a specific agent
// GET /agents/:agentId
// Fetches details of a specific agent by ID, ensuring it belongs to the user before returning data
// 
router.get("/agents/:agentId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /agents/:agentId");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }
    const { agentId } = validateUUIDParams(req.params as { agentId: string; roomId?: string }, res) ?? { agentId: null };
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
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
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
    elizaLogger.error("[CLIENT-DIRECT] Error fetching agent:", { message: error.message, stack: error.stack });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch agent", details: error.message });
  }
});



// Delete an agent
// DELETE /agents/:agentId
// Stops and unregisters an agent, ensuring it belongs to the user before deletion
// Note: This does not delete the character from Sanity, only stops the agent runtime
router.delete("/agents/:agentId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /agents/:agentId");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }
    const { agentId } = validateUUIDParams(req.params as { agentId: string; roomId?: string }, res) ?? { agentId: null };
    if (!agentId) return;

    // Check if the character belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }

    const agent: AgentRuntime = agents.get(agentId);
    if (agent) {
      agent.stop();
      directClient.unregisterAgent(agent);
      res.status(204).json({ success: true });
    } else {
      res.status(404).json({ error: "Agent not found" });
    }
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error deleting agent:", { message: error.message, stack: error.stack });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to delete agent", details: error.message });
  }
});



// Start an agent
// POST /agent/start
// Starts an agent from a character JSON or file path and registers it with the runtime
// Returns the agent ID and character data in the response
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
            elizaLogger.log(`[CLIENT-DIRECT] ${character.name} started`);

            res.json({
                id: character.id,
                character: character,
            });
        } catch (e) {
            elizaLogger.error(`[CLIENT-DIRECT] Error parsing character: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });



// Stop an agent
// POST /agents/:agentId/stop
// Stops and unregisters a specific agent by ID without deleting the character
// Useful for temporarily halting an agent's activity without removing its data 
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
            res.status(404).json({ error: "[CLIENT-DIRECT] Agent not found" });
        }
    });



// Set or update an agent
// POST /agents/:agentId/set
// Updates or sets an agent's character data, restarting the agent 
// if it already exists. Also updates or creates the character in Sanity.
router.post("/agents/:agentId/set", async (req, res) => {
  const { agentId } = validateUUIDParams(req.params, res) ?? {
    agentId: null,
  };
  if (!agentId) return;

  let agent: AgentRuntime = agents.get(agentId);

  if (agent) {
    agent.stop();
    directClient.unregisterAgent(agent);
  }

  const characterJson = { ...req.body };
  const character = req.body;
  try {
    validateCharacterConfig(character);
  } catch (e) {
    elizaLogger.error(`[CLIENT-DIRECT] Error parsing character: ${e}`);
    res.status(400).json({
      success: false,
      message: e.message,
    });
    return;
  }

  // Add _key to arrays requiring it
  if (character.settings?.secrets?.dynamic) {
    character.settings.secrets.dynamic = ensureKeys(character.settings.secrets.dynamic);
  }
  const validatedMessageExamples = character.messageExamples
    ? ensureKeys(
        character.messageExamples.map((example: any) => ({
          ...example,
          conversation: ensureKeys(example.conversation || []),
        }))
      )
    : [];
  const validatedKnowledge = character.knowledge
    ? ensureKeys(
        character.knowledge.map((item: any) =>
          item._type === 'reference' ? item : { ...item, directory: item.directory, shared: item.shared ?? false }
        )
      )
    : [];
  character.messageExamples = validatedMessageExamples;
  character.knowledge = validatedKnowledge;

  // Check if character exists in Sanity and update if necessary
  const existingCharacter = await sanityClient.fetch(
    `*[_type == "character" && id == $agentId][0]`,
    { agentId }
  );
  if (existingCharacter) {
    await sanityClient
      .patch(existingCharacter._id)
      .set({
        name: character.name,
        username: character.username,
        system: character.system || "",
        bio: character.bio || [],
        lore: character.lore || [],
        messageExamples: validatedMessageExamples,
        postExamples: character.postExamples || [],
        topics: character.topics || [],
        adjectives: character.adjectives || [],
        style: character.style || { all: [], chat: [], post: [] },
        modelProvider: character.modelProvider || "OPENAI",
        plugins: character.plugins || [],
        settings: character.settings || {
          secrets: { dynamic: [] },
          ragKnowledge: false,
          voice: { model: "default" },
        },
        knowledge: validatedKnowledge,
        updatedAt: new Date().toISOString(),
      })
      .commit();
    elizaLogger.debug(`[CLIENT-DIRECT] Updated character in Sanity: id=${agentId}`);
  }

  try {
    agent = await directClient.startAgent(character);
    elizaLogger.log(`[CLIENT-DIRECT] ${character.name} started`);
  } catch (e) {
    elizaLogger.error(`[CLIENT-DIRECT] Error starting agent: ${e}`);
    res.status(500).json({
      success: false,
      message: e.message,
    });
    return;
  }

  if (process.env.USE_CHARACTER_STORAGE === "true") {
    try {
      const filename = `${agent.agentId}.json`;
      const uploadDir = path.join(process.cwd(), "data", "characters");
      const filepath = path.join(uploadDir, filename);
      await fs.promises.mkdir(uploadDir, { recursive: true });
      await fs.promises.writeFile(
        filepath,
        JSON.stringify({ ...characterJson, id: agent.agentId }, null, 2)
      );
      elizaLogger.debug(`[CLIENT-DIRECT] Character stored successfully at ${filepath}`);
    } catch (error) {
      elizaLogger.error(`[CLIENT-DIRECT] Failed to store character: ${error.message}`);
    }
  }

  res.json({
    id: character.id,
    character,
  });
});


// Get Discord channels for an agent
// GET /agents/:agentId/channels
// Fetches Discord guilds (servers) the agent is part of using the Discord API
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


// Get memories for an agent in a room
// GET /agents/:agentId/:roomId/memories
// Fetches conversation memories for a specific agent and room from the message manager, including metadata
// New inclusion: metadata field in memory content is now included in the response, useful for RAG contexts
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
                         metadata: memory.content.metadata, // Include metadata
                    },
                    embedding: memory.embedding,
                    roomId: memory.roomId,
                    unique: memory.unique,
                    similarity: memory.similarity,
                })),
            };

            res.json(response);
        } catch (error) {
            console.error("[CLIENT-DIRECT] Error fetching memories:", error);
            res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch memories" });
        }
    });



// Retrieve messages for an agent
// GET /:agentId/messages
// Fetches messages for a specific agent, room, and time range, with an option to get only the last message
// New query parameter: lastOnly=true to fetch only the most recent message
router.get("/:agentId/messages", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { agentId } = req.params;
    const roomId = stringToUuid(req.query.roomId as string || `default-room-${agentId}`);
    const count = parseInt(req.query.count as string || "50");
    const start = parseInt(req.query.start as string || (Date.now() - 24 * 60 * 60 * 1000).toString());
    const lastOnly = req.query.lastOnly === "true"; // New query parameter

    // Log request details
    elizaLogger.info("[GET_MESSAGES] Received request to fetch messages", {
      agentId,
      userId,
      roomId,
      count,
      start,
      lastOnly,
      queryParams: req.query,
    });

    // Find agent runtime
    let runtime = agents.get(agentId);
    if (!runtime) {
      runtime = Array.from(agents.values()).find(
        (a) =>
          a.character.id === agentId ||
          a.character.name.toLowerCase() === agentId.toLowerCase() ||
          stringToUuid(a.character.name) === agentId
      );
    }
    if (!runtime) {
      elizaLogger.error("[GET_MESSAGES] Agent not found", { agentId });
      return res.status(404).json({ error: "Agent not found" });
    }
    elizaLogger.info("[GET_MESSAGES] Agent runtime found", {
      agentId,
      characterId: runtime.character.id,
      characterName: runtime.character.name,
    });

    // Verify user access to the character
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.error("[GET_MESSAGES] User not found in Sanity", { userId });
      return res.status(404).json({ error: "User not found" });
    }
    elizaLogger.info("[GET_MESSAGES] User found", { userId, userRef: User._id });

    const characterDoc = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: User._id }
    );
    if (!characterDoc) {
      elizaLogger.error("[GET_MESSAGES] Character not found or access denied", {
        agentId,
        userRef: User._id,
      });
      return res.status(404).json({ error: "Character not found or access denied" });
    }
    elizaLogger.info("[GET_MESSAGES] Character verified", {
      characterId: characterDoc._id,
      agentId,
    });

    // Fetch memories
    elizaLogger.info("[GET_MESSAGES] Fetching memories from messageManager", {
      roomId,
      count,
      start,
      lastOnly,
    });
    let memories = await runtime.messageManager.getMemories({
      roomId,
      count: lastOnly ? 1 : count, // Fetch only 1 memory if lastOnly is true
      start,
    });

    // Sort by createdAt descending and take the most recent if lastOnly is true
    if (lastOnly) {
      memories = memories.sort((a: Memory, b: Memory) => b.createdAt - a.createdAt).slice(0, 1);
    }
    elizaLogger.info("[GET_MESSAGES] Memories fetched", {
      memoryCount: memories.length,
      roomId,
      lastOnly,
    });

    // Map memories to messages
    const messages = memories.map((memory: Memory) => {
      const message = {
        ...memory.content,
        user: memory.userId === userId ? "user" : "system",
        createdAt: memory.createdAt,
        metadata: memory.content.metadata || {},
      };
      return message;
    });
    elizaLogger.info("[GET_MESSAGES] Messages processed", {
      messageCount: messages.length,
      messages: messages.map((msg: any) => ({
        text: msg.text,
        user: msg.user,
        createdAt: msg.createdAt,
        source: msg.source,
        action: msg.metadata?.action,
        txHash: msg.metadata?.txHash,
        publicKey: msg.metadata?.publicKey,
      })),
    });

    // Send response
    elizaLogger.info("[GET_MESSAGES] Sending response", { messageCount: messages.length });
    res.json(messages);
  } catch (error: any) {
    elizaLogger.error("[GET_MESSAGES] Error fetching messages", {
      error: error.message,
      stack: error.stack,
      agentId: req.params.agentId,
      userId: req.userId,
      roomId: req.query.roomId,
      lastOnly: req.query.lastOnly,
    });
    res.status(500).json({ error: "Failed to fetch messages", details: error.message });
  }
});




// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------















































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ------------------------Knowledge Management Endpoints----------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Sanity webhook for knowledge updates
// POST /webhooks/sanity/knowledge
// Processes create, update, or delete events for knowledge items, syncing with the agent's knowledge manager and database 
// Expects Sanity document in request body and operation type in 'sanity-operation' header (create, update, delete) 
// Validates payload, checks agent existence, and handles knowledge item accordingly, logging actions and errors
// Removes existing knowledge and chunks on create/update before adding new data, and cleans up on delete, ensuring data integrity
router.post('/webhooks/sanity/knowledge', async (req, res) => {
  elizaLogger.debug('[WEBHOOK] Received request', { headers: req.headers, body: req.body });

  const document = req.body; // Document fields are in req.body directly
  const operation = req.headers['sanity-operation']; // Get operation from header

  // Validate payload
  if (!document || !document.agentId || !document.id || !operation) {
    elizaLogger.warn('[WEBHOOK] Invalid payload received:', { body: req.body, operation });
    return res.status(400).json({ error: 'Invalid payload: missing agentId, id, or operation' });
  }

  const agentId = document.agentId;
  const agent = agents.get(agentId);

  if (!agent) {
    elizaLogger.warn(`[WEBHOOK] Agent not found for agentId: ${agentId}`);
    return res.status(404).json({ error: 'Agent not found' });
  }

  const knowledgeManager = agent.ragKnowledgeManager;

  try {
    if (operation === 'create' || operation === 'update') {
      // Remove existing knowledge and chunks
      await knowledgeManager.removeKnowledge(document.id);
      const chunksSql = "DELETE FROM knowledge WHERE json_extract(content, '$.metadata.originalId') = ?";
      agent.databaseAdapter.db.prepare(chunksSql).run(document.id);
      elizaLogger.debug(`[WEBHOOK] Removed existing knowledge and chunks for id: ${document.id}`);

      // Generate embedding for the new/updated knowledge
      const text = document.text;
      const embeddingArray = await embed(agent, text);
      const embedding = new Float32Array(embeddingArray);

      // Create new knowledge item
      const knowledgeItem: RAGKnowledgeItem = {
        id: document.id,
        agentId: document.agentId,
        content: {
          text: document.text,
          metadata: document.metadata || {},
        },
        embedding,
        createdAt: new Date(document.createdAt || Date.now()).getTime(),
      };

      await knowledgeManager.createKnowledge(knowledgeItem);
      elizaLogger.debug(`[WEBHOOK] Processed ${operation} for knowledge id: ${document.id}, agentId: ${agentId}`);
    } else if (operation === 'delete') {
      // Remove knowledge and its chunks
      await knowledgeManager.removeKnowledge(document.id);
      const chunksSql = "DELETE FROM knowledge WHERE json_extract(content, '$.metadata.originalId') = ?";
      agent.databaseAdapter.db.prepare(chunksSql).run(document.id);
      elizaLogger.debug(`[WEBHOOK] Deleted knowledge id: ${document.id} and its chunks for agentId: ${agentId}`);
    } else {
      elizaLogger.warn(`[WEBHOOK] Unsupported operation: ${operation}`);
      return res.status(400).json({ error: `Unsupported operation: ${operation}` });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    elizaLogger.error('[WEBHOOK] Error processing webhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook', details: error.message });
  }
});



// Retrieve knowledge items for an agent
// GET /agents/:agentId/knowledge
// Fetches all knowledge items associated with a specific agent and user, validating ownership of the agent 
// Returns knowledge items with their IDs, titles, texts, and metadata fields only
router.get("/agents/:agentId/knowledge", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    const { agentId } = req.params;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /agents/:agentId/knowledge");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    // Validate that the character belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }

    // Fetch knowledge items for this agent
    const knowledgeItems = await sanityClient.fetch(
      `*[_type == "knowledge" && agentId == $agentId]`,
      { agentId }
    );
    res.json({ knowledge: knowledgeItems });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching knowledge:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch knowledge" });
  }
});



// Create a knowledge item
// POST /agents/:agentId/knowledge
// Creates a new knowledge item for an agent, respecting subscription limits and validating ownership
// Requires name and text fields in the request body 
router.post("/agents/:agentId/knowledge", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    const { agentId } = req.params;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /agents/:agentId/knowledge");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }

    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]{settings}`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }
    if (!character.settings?.ragKnowledge) {
      return res.status(403).json({ error: "[CLIENT-DIRECT] Knowledge feature is not enabled for this character" });
    }

    // Check subscription limits
    let limits;
    try {
      
      limits = await getUserSubscriptionLimits(userId);
    } catch (error) {
      elizaLogger.warn(`[CLIENT-DIRECT] Subscription check failed for userId: ${userId}`, error);
      return res.status(403).json({ error: "Unable to verify subscription limits" });
    }
    const existingDocsCount = await sanityClient.fetch(
      `count(*[_type == "knowledge" && agentId == $agentId])`,
      { agentId }
    );
    if (existingDocsCount >= limits.maxKnowledgeDocsPerAgent) {
      return res.status(403).json({ error: "Maximum number of knowledge documents reached for this agent" });
    }
    const existingDocs = await sanityClient.fetch(
      `*[_type == "knowledge" && agentId == $agentId]{text}`,
      { agentId }
    );
    const currentTotalChars = existingDocs.reduce((sum, doc) => sum + (doc.text?.length || 0), 0);

    const { name, text, metadata } = req.body;
    if (!name || !text) {
      return res.status(400).json({ error: "[CLIENT-DIRECT] Name and text are required" });
    }
    if (text.length > limits.maxCharsPerKnowledgeDoc) {
      return res.status(403).json({
        error: `Knowledge document exceeds maximum characters allowed: ${limits.maxCharsPerKnowledgeDoc}`,
      });
    }
    if (currentTotalChars + text.length > limits.maxTotalCharsPerAgent) {
      return res.status(403).json({
        error: "Adding this knowledge document would exceed the total character limit for the agent",
      });
    }

    const knowledgeId = uuidv4();
    const knowledgeDoc = {
      _type: "knowledge",
      id: knowledgeId,
      name,
      agentId: req.params.agentId,
      text,
      metadata: metadata || {},
      createdAt: new Date().toISOString(),
    };
    const createdKnowledge = await sanityClient.create(knowledgeDoc);

    res.json({ knowledge: createdKnowledge });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error creating knowledge:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to create knowledge" });
  }
});



// Update a knowledge item
// PATCH /agents/:agentId/knowledge/:knowledgeId
// Updates an existing knowledge item, respecting subscription limits and validating ownership 
// Allows updating name, text, and metadata fields of the knowledge item 
router.patch("/agents/:agentId/knowledge/:knowledgeId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    const { agentId, knowledgeId } = req.params;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /agents/:agentId/knowledge/:knowledgeId");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }

    elizaLogger.debug(`[PATCH] Processing knowledge update for agentId: ${agentId}, knowledgeId: ${knowledgeId}`);

    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]{settings}`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId}, userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }
    if (!character.settings?.ragKnowledge) {
      return res.status(403).json({ error: "[CLIENT-DIRECT] Knowledge feature is not enabled for this character" });
    }

    const knowledge = await sanityClient.fetch(
      `*[_type == "knowledge" && id == $knowledgeId && agentId == $agentId][0]{_id, text}`,
      { knowledgeId, agentId }
    );
    if (!knowledge || !knowledge._id) {
      elizaLogger.warn(`[CLIENT-DIRECT] Knowledge not found or missing _id for knowledgeId: ${knowledgeId}, agentId: ${agentId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] Knowledge item not found or invalid" });
    }

    let limits;
    try {
      limits = await getUserSubscriptionLimits(userId);
    } catch (error) {
      elizaLogger.error(`[CLIENT-DIRECT] Failed to fetch subscription limits for userId: ${userId}`, error);
      return res.status(500).json({ error: "[CLIENT-DIRECT] Unable to verify subscription limits", details: error.message });
    }

    const existingDocs = await sanityClient.fetch(
      `*[_type == "knowledge" && agentId == $agentId && id != $knowledgeId]{text}`,
      { agentId, knowledgeId }
    );
    const currentTotalChars = existingDocs.reduce((sum, doc) => sum + (doc.text?.length || 0), 0);
    const oldTextLength = knowledge.text?.length || 0;

    const { name, text, metadata } = req.body;
    elizaLogger.debug(`[PATCH] Request body:`, { name, textLength: text?.length, metadata });
    if (!name && !text && !metadata) {
      return res.status(400).json({ error: "[CLIENT-DIRECT] At least one field (name, text, or metadata) is required" });
    }
    const newTextLength = text ? text.length : oldTextLength;
    if (newTextLength > limits.maxCharsPerKnowledgeDoc) {
      return res.status(403).json({
        error: `Updated knowledge document exceeds maximum characters allowed: ${limits.maxCharsPerKnowledgeDoc}`,
      });
    }
    if (currentTotalChars - oldTextLength + newTextLength > limits.maxTotalCharsPerAgent) {
      return res.status(403).json({
        error: "Updating this knowledge document would exceed the total character limit for the agent",
      });
    }

    const updatedKnowledge = await sanityClient
      .patch(knowledge._id)
      .set({
        ...(name && { name }),
        ...(text && { text }),
        ...(metadata && { metadata }),
        updatedAt: new Date().toISOString(),
      })
      .commit();

    elizaLogger.debug(`[CLIENT-DIRECT] Updated knowledge item: knowledgeId=${knowledgeId}, agentId=${agentId}`);
    res.json({ knowledge: updatedKnowledge });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error updating knowledge:", {
      error: error.message,
      stack: error.stack,
      agentId: req.params.agentId,
      knowledgeId: req.params.knowledgeId,
      requestBody: req.body,
    });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to update knowledge", details: error.message });
  }
});



// Delete a knowledge item
// DELETE /agents/:agentId/knowledge/:knowledgeId
// Deletes a knowledge item from an agent after validating ownership and existence of the item
// Also removes associated chunks from the database to maintain data integrity
router.delete("/agents/:agentId/knowledge/:knowledgeId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    const { agentId, knowledgeId } = req.params;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /agents/:agentId/knowledge/:knowledgeId");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    // Validate character ownership and ragKnowledge setting
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]{settings}`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }
    if (!character.settings?.ragKnowledge) {
      return res.status(403).json({ error: "[CLIENT-DIRECT] Knowledge feature is not enabled for this character" });
    }

    // Validate knowledge item exists and belongs to the agent
    const knowledge = await sanityClient.fetch(
      `*[_type == "knowledge" && id == $knowledgeId && agentId == $agentId][0]`,
      { knowledgeId, agentId }
    );
    if (!knowledge) {
      elizaLogger.warn(`[CLIENT-DIRECT] Knowledge not found for knowledgeId: ${knowledgeId} and agentId: ${agentId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] Knowledge item not found" });
    }

    // Delete knowledge document
    await sanityClient.delete(knowledge._id);
    elizaLogger.debug(`[CLIENT-DIRECT] Deleted knowledge item: knowledgeId=${knowledgeId}, agentId=${agentId}`);
    res.status(204).json({ success: true });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error deleting knowledge:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to delete knowledge" });
  }
});




// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------






































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ---------------------Email Template Management Endpoints--------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Retrieve email template for an agent
// GET /agents/:agentId/email-template
// Fetches the email template associated with a specific agent
// Returns null if no template exists for the agent to allow defaults to be used client-side if needed
// Requires authentication and verifies character ownership by the user 
router.get("/agents/:agentId/email-template", async (req, res) => {
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
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    // Validate that the character belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }

    // Fetch email template for this agent
    const emailTemplate = await sanityClient.fetch(
      `*[_type == "emailTemplate" && agentId == $agentId][0]`,
      { agentId }
    );

    res.json({ emailTemplate: emailTemplate || null });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching email template:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch email template" });
  }
});



// Update or create email template for an agent
// PATCH /agents/:agentId/email-template
// Updates or creates an email template for an agent with validation to ensure the template includes a {{body}} placeholder
// Requires authentication and verifies character ownership by the user 
router.patch("/agents/:agentId/email-template", async (req, res) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const userId = session.getUserId();
    const { agentId } = req.params;
    const { position, emailAddress, companyName, instructions, bestRegard, template } = req.body;

    // Validate template field
    if (!template || !template.includes('{{body}}')) {
      elizaLogger.warn(`[CLIENT-DIRECT] Invalid template: missing {{body}} placeholder`);
      return res.status(400).json({ error: "[CLIENT-DIRECT] Template must include {{body}} placeholder" });
    }

    // Fetch User document to get _id
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn(`[CLIENT-DIRECT] No User found for userId: ${userId}`);
      return res.status(404).json({ error: "[CLIENT-DIRECT] User not found in Sanity" });
    }

    // Validate that the character belongs to the user
    const character = await sanityClient.fetch(
      `*[_type == "character" && id == $agentId && createdBy._ref == $userRef][0]`,
      { agentId, userRef: User._id }
    );
    if (!character) {
      elizaLogger.warn(`[CLIENT-DIRECT] Character not found for agentId: ${agentId} and userRef: ${User._id}`);
      return res.status(403).json({ error: "[CLIENT-DIRECT] Character not found or access denied" });
    }

    // Fetch existing email template
    const existingTemplate = await sanityClient.fetch(
      `*[_type == "emailTemplate" && agentId == $agentId][0]`,
      { agentId }
    );

    const templateData = {
      _type: "emailTemplate",
      agentId,
      position: position || '',
      emailAddress: emailAddress || '',
      companyName: companyName || '',
      instructions: instructions || '',
      bestRegard: bestRegard || '',
      template: template || 'Dear {{sender}},\n\n{{body}}\n\n{{bestRegard}},\n{{agentName}}',
    };

    let updatedTemplate;
    if (existingTemplate) {
      // Update existing template
      updatedTemplate = await sanityClient
        .patch(existingTemplate._id)
        .set(templateData)
        .commit();
    } else {
      // Create new template
      updatedTemplate = await sanityClient.create(templateData);
    }

    elizaLogger.debug(`[CLIENT-DIRECT] Email template updated for agentId: ${agentId}`);
    res.json({ emailTemplate: updatedTemplate });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error updating email template:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to update email template" });
  }
});



// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------










































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// --------------------------Miscellaneous Endpoints---------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------




// router.post("/auth/signout", async (req: express.Request, res: express.Response) => {
//   elizaLogger.debug("[CLIENT-DIRECT] Request received: POST /auth/signout", {
//     cookies: req.headers.cookie || "none",
//     authorization: req.headers.authorization || "none",
//   });

//   try {
//     // Attempt to get session (sessionRequired: false to handle cases where session is already invalid)
//     const session = await Session.getSession(req, res, { sessionRequired: false });
//     const userId = session?.getUserId();

//     if (session) {
//       // Revoke the session server-side
//       await session.revokeSession();
//       elizaLogger.debug("[CLIENT-DIRECT] Session revoked", { userId });
//     } else {
//       elizaLogger.debug("[CLIENT-DIRECT] No session found for POST /auth/signout");
//     }

//     // Clear all SuperTokens-related cookies explicitly
//     const cookiesToClear = [
//       { name: "sAccessToken", path: "/", domain: "agentvooc.com" },
//       { name: "sRefreshToken", path: "/api/auth/session/refresh", domain: "agentvooc.com" },
//       { name: "sFrontToken", path: "/", domain: "agentvooc.com" },
//       { name: "st-last-access-token-update", path: "/", domain: "agentvooc.com" },
//       { name: "st-access-token", path: "/", domain: "agentvooc.com" },
//       { name: "st-refresh-token", path: "/api/auth/session/refresh", domain: "agentvooc.com" },
//     ];

//     cookiesToClear.forEach(({ name, path, domain }) => {
//       res.clearCookie(name, {
//         path,
//         domain,
//         secure: true,
//         sameSite: "strict",
//         expires: new Date(0),
//       });
//     });

//     elizaLogger.debug("[CLIENT-DIRECT] Cookies cleared server-side", { cookies: cookiesToClear.map(c => c.name) });

//     // Set headers to prevent caching
//     res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
//     res.setHeader("Pragma", "no-cache");
//     res.setHeader("Expires", "0");

//     res.status(200).json({ status: "OK" });
//   } catch (error: any) {
//     elizaLogger.error("[CLIENT-DIRECT] Error in POST /auth/signout:", {
//       message: error.message,
//       stack: error.stack,
//     });
//     res.status(500).json({ error: "Failed to sign out", details: error.message });
//   }
// });

router.get("/items", async (req, res) => {
  try {
    const { itemType } = req.query;
    const items: Item[] = [];

    // 1. Fetch items from Sanity
    try {
      let query = `*[_type == "Item"]{id, name, description, price, itemType, pluginName, stripePriceId, features, isPopular, trialInfo, useCase}`;
      let params = {};

      if (itemType && typeof itemType === "string") {
        query = `*[_type == "Item" && itemType == $itemType]{id, name, description, price, itemType, pluginName, stripePriceId, features, isPopular, trialInfo, useCase}`;
        params = { itemType };
      }

      // Use params instead of { itemType }
      const sanityItems = await sanityClient.fetch(query, params);
      items.push(
        ...sanityItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          itemType: item.itemType,
          pluginName: item.pluginName || undefined, // New field for plugin-based subscriptions
          stripePriceId: item.stripePriceId || undefined, // New field for Stripe integration
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
    //         pluginName: item.pluginName || undefined, // Support for plugin-based model
    //         stripePriceId: item.stripePriceId || undefined, // Support for Stripe integration
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

    // // 3. Add static fallback items (updated for plugin-based model)
    // const staticItems: Item[] = [
    //   {
    //     id: "static-base",
    //     name: "Base Plan",
    //     description: "Essential plan to access agentVooc dashboard and create characters.",
    //     price: 500, // $5.00
    //     itemType: "subscription",
    //     stripePriceId: "price_base_plan", // Stripe price ID for base plan
    //     features: [
    //       "Access to agentVooc dashboard",
    //       "Create unlimited AI characters",
    //       "Basic character management",
    //       "Community support",
    //     ],
    //     isPopular: false,
    //     trialInfo: "7-day free trial",
    //     useCase: "Required for dashboard access",
    //     source: "static",
    //   },
    //   {
    //     id: "static-plugin-email",
    //     name: "Email Plugin",
    //     description: "Enable email functionality for your AI characters.",
    //     price: 300, // $3.00
    //     itemType: "plugin",
    //     pluginName: "email",
    //     stripePriceId: "price_plugin_email",
    //     features: [
    //       "Send and receive emails",
    //       "Email templates",
    //       "Automated responses",
    //       "Email analytics",
    //     ],
    //     isPopular: true,
    //     trialInfo: "3-day free trial",
    //     useCase: "Best for customer support",
    //     source: "static",
    //   },
    //   {
    //     id: "static-plugin-twitter",
    //     name: "Twitter Plugin",
    //     description: "Connect your AI characters to Twitter/X platform.",
    //     price: 400, // $4.00
    //     itemType: "plugin",
    //     pluginName: "twitter",
    //     stripePriceId: "price_plugin_twitter",
    //     features: [
    //       "Post tweets automatically",
    //       "Respond to mentions",
    //       "Trend analysis",
    //       "Engagement metrics",
    //     ],
    //     isPopular: true,
    //     trialInfo: "3-day free trial",
    //     useCase: "Best for social media management",
    //     source: "static",
    //   },
    //   {
    //     id: "static-plugin-discord",
    //     name: "Discord Plugin",
    //     description: "Deploy your AI characters as Discord bots.",
    //     price: 350, // $3.50
    //     itemType: "plugin",
    //     pluginName: "discord",
    //     stripePriceId: "price_plugin_discord",
    //     features: [
    //       "Discord bot integration",
    //       "Server management",
    //       "Custom commands",
    //       "Voice channel support",
    //     ],
    //     isPopular: false,
    //     trialInfo: "3-day free trial",
    //     useCase: "Best for community management",
    //     source: "static",
    //   },
    //   // Legacy plans (commented out but kept for reference)
    //   // {
    //   //   id: "static-1",
    //   //   name: "Basic Plan",
    //   //   description: "A basic subscription plan for agentVooc.",
    //   //   price: 500, // $5.00
    //   //   itemType: "subscription",
    //   //   features: [
    //   //     "1 AI character",
    //   //     "100 conversations/month",
    //   //     "Basic RAG knowledge",
    //   //     "Sanity CMS access",
    //   //   ],
    //   //   isPopular: false,
    //   //   trialInfo: "7-day free trial",
    //   //   useCase: "Best for individuals",
    //   //   source: "static",
    //   // },
    //   // {
    //   //   id: "static-2",
    //   //   name: "Premium Plan",
    //   //   description: "A premium subscription plan for agentVooc.",
    //   //   price: 1500, // $15.00
    //   //   itemType: "subscription",
    //   //   features: [
    //   //     "5 AI characters",
    //   //     "1000 conversations/month",
    //   //     "Advanced RAG knowledge",
    //   //     "Priority support",
    //   //   ],
    //   //   isPopular: true,
    //   //   trialInfo: "30-day money-back guarantee",
    //   //   useCase: "Best for teams",
    //   //   source: "static",
    //   // },
    // ];
    // items.push(...staticItems);
    // elizaLogger.debug(`Added ${staticItems.length} static items`);

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



router.get('/storage', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId; // Use Clerk's userId from middleware
    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for /storage");
      return res.status(401).json({ error: "[CLIENT-DIRECT] Unauthorized: No user ID found" });
    }
    const uploadDir = path.join(process.cwd(), "data", "characters");
    const files = await fs.promises.readdir(uploadDir);
    res.json({ files });
  } catch (error) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching storage", { message: error.message, stack: error.stack });
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch storage", details: error.message });
  }
});


// Define unique keys that require unique values across characters
const uniqueKeysRequired = [
  "EMAIL_OUTGOING_USER",
  "EMAIL_OUTGOING_PASS",
  "EMAIL_INCOMING_USER",
  "EMAIL_INCOMING_PASS",
  "TWITTER_USERNAME",
  "TWITTER_PASSWORD",
  "TWITTER_EMAIL",
  "TELEGRAM_BOT_TOKEN",
  "INSTAGRAM_USERNAME",
  "INSTAGRAM_PASSWORD",
  "INSTAGRAM_APP_ID",
];


// Fetch used hashes for unique keys
async function getUsedUniqueKeyHashes(excludeCharacterId: string | null = null) {
  const filter = excludeCharacterId ? `&& _id != $excludeId` : '';
  const query = `*[_type == "character" ${filter}]{
    "secrets": settings.secrets.dynamic[ @.key in $uniqueKeysRequired ]{key, hash}
  }`;
  const params = {
    uniqueKeysRequired,
    ...(excludeCharacterId ? { excludeId: excludeCharacterId } : {})
  };
  const result = await sanityClient.fetch(query, params);
  const allSecrets = result.flatMap((char: any) => char.secrets);
  return new Set(allSecrets.map((secret: any) => `${secret.key}:${secret.hash}`));
}


// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



    

    





































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ---------------------TEE Log Management Endpoints---------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------


// Get all TEE agents
// GET /tee/agents
// Retrieves a list of all TEE agents with attestation
// Assumes at least one agent runtime is available to provide the TeeLogService
// Aggregates agents from all runtimes
// Returns attestation for the aggregated list of agents
// Note: In a real-world scenario, consider pagination for large datasets
// Note: Ensure proper error handling if no runtimes are available
// Note: This endpoint is read-only and does not modify any state
// Note: The attestation is generated using the first available runtime's TeeLogService
// Note: This endpoint is intended for administrative or monitoring purposes
// Note: Ensure that the attestation mechanism is secure and tamper-proof
// Note: The response includes both the list of agents and the attestation for verification
// Note: This endpoint may require authentication and authorization in a production environment
    router.get("/tee/agents", async (req, res) => {
        try {
            const allAgents = [];

            for (const agentRuntime of agents.values()) {
                const teeLogService = agentRuntime
                    .getService<TeeLogService>(ServiceType.TEE_LOG)
                    .getInstance();

                const agents = await teeLogService.getAllAgents();
                allAgents.push(...agents);
            }

            const runtime: AgentRuntime = agents.values().next().value;
            const teeLogService = runtime
                .getService<TeeLogService>(ServiceType.TEE_LOG)
                .getInstance();
            const attestation = await teeLogService.generateAttestation(
                JSON.stringify(allAgents)
            );
            res.json({ agents: allAgents, attestation: attestation });
        } catch (error) {
            elizaLogger.error("[CLIENT-DIRECT] Failed to get TEE agents:", error);
            res.status(500).json({
                error: "[CLIENT-DIRECT] Failed to get TEE agents",
            });
        }
    });


// Get specific TEE agent by ID
// GET /tee/agents/:agentId
// Retrieves details of a specific TEE agent by its ID with attestation
// Validates that the agent exists in the runtime
// Returns 404 if the agent is not found
// Returns attestation for the agent details
// Note: In a real-world scenario, consider additional validation and error handling
// Note: This endpoint is read-only and does not modify any state
// Note: The attestation is generated using the TeeLogService of the runtime where the agent resides
// Note: This endpoint is intended for administrative or monitoring purposes
// Note: Ensure that the attestation mechanism is secure and tamper-proof
// Note: The response includes both the agent details and the attestation for verification
// Note: This endpoint may require authentication and authorization in a production environment
// Note: Ensure proper error handling if the runtime or service is unavailable
// Note: Consider rate limiting to prevent abuse
// Note: The agentId parameter should be validated to prevent injection attacks
// Note: The response time may vary based on the runtime's performance and load
// Note: This endpoint may be logged for auditing purposes
    router.get("/tee/agents/:agentId", async (req, res) => {
        try {
            const agentId = req.params.agentId;
            const agentRuntime = agents.get(agentId);
            if (!agentRuntime) {
                res.status(404).json({ error: "Agent not found" });
                return;
            }

            const teeLogService = agentRuntime
                .getService<TeeLogService>(ServiceType.TEE_LOG)
                .getInstance();

            const teeAgent = await teeLogService.getAgent(agentId);
            const attestation = await teeLogService.generateAttestation(
                JSON.stringify(teeAgent)
            );
            res.json({ agent: teeAgent, attestation: attestation });
        } catch (error) {
            elizaLogger.error("[CLIENT-DIRECT] Failed to get TEE agent:", error);
            res.status(500).json({
                error: "[CLIENT-DIRECT] Failed to get TEE agent",
            });
        }
    });



// Query TEE logs with filters and pagination
// POST /tee/logs
// Accepts query parameters in the request body to filter logs and supports pagination 
// Returns logs matching the query along with an attestation of the results
// Note: Ensure proper validation and sanitization of input parameters
// Note: This endpoint is read-only and does not modify any state 
// Note: The attestation is generated using the TeeLogService of the first available runtime
// Note: This endpoint is intended for administrative or monitoring purposes 
// Note: Ensure that the attestation mechanism is secure and tamper-proof 
// Note: The response includes both the logs and the attestation for verification
// Note: This endpoint may require authentication and authorization in a production environment
// Note: Consider rate limiting to prevent abuse
// Note: The query parameters should be validated to prevent injection attacks
// Note: The response time may vary based on the runtime's performance and load
// Note: This endpoint may be logged for auditing purposes
    router.post(
        "/tee/logs",
        async (req: express.Request, res: express.Response) => {
            try {
                const query = req.body.query || {};
                const page = Number.parseInt(req.body.page) || 1;
                const pageSize = Number.parseInt(req.body.pageSize) || 10;

                const teeLogQuery: TeeLogQuery = {
                    agentId: query.agentId || "",
                    roomId: query.roomId || "",
                    userId: query.userId || "",
                    type: query.type || "",
                    containsContent: query.containsContent || "",
                    startTimestamp: query.startTimestamp || undefined,
                    endTimestamp: query.endTimestamp || undefined,
                };
                const agentRuntime: AgentRuntime = agents.values().next().value;
                const teeLogService = agentRuntime
                    .getService<TeeLogService>(ServiceType.TEE_LOG)
                    .getInstance();
                const pageQuery = await teeLogService.getLogs(
                    teeLogQuery,
                    page,
                    pageSize
                );
                const attestation = await teeLogService.generateAttestation(
                    JSON.stringify(pageQuery)
                );
                res.json({
                    logs: pageQuery,
                    attestation: attestation,
                });
            } catch (error) {
                elizaLogger.error("[CLIENT-DIRECT] Failed to get TEE logs:", error);
                res.status(500).json({
                    error: "[CLIENT-DIRECT] Failed to get TEE logs",
                });
            }
        }
    );



// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



















































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ------------------------------Content Endpoint------------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Fetch landing page content
// GET /landing-page
// Retrieves the landing page content from Sanity CMS and formats image URLs with multiple variants
// Uses the urlFor helper to generate optimized image URLs for different sizes and formats
  router.get("/landing-page", async (req, res) => {
  try {
    // Query the landingPage document from Sanity
    const query = `*[_type == "landingPage"][0] {
      _updatedAt,
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
          role,
          image {
            asset-> {
              _id,
              url
            }
          }
        },
        trustSignal,
        sectionImage {
          asset-> {
            _id,
            url
          }
        }
      },
      ctaSection {
        heading,
        description,
        ctaText,
        ctaUrl,
      },
      footerSection {
        tagline,
        companyLinks[] { label, url },
        productLinks[] { label, url },
        legalLinks[] { label, url },
        socialLinks[] { platform, url }
      },
      subFooterSection {
        ctaText,
        ctaUrl,
        copyright
      }
    }`;

    const landingPage = await sanityClient.fetch(query);

    if (!landingPage) {
      elizaLogger.debug("[CLIENT-DIRECT] No landing page found in Sanity");
      return res.status(404).json({ error: "[CLIENT-DIRECT] Landing page not found" });
    }

    // Use urlFor to generate optimized image URLs with multiple variants
    const formattedLandingPage = {
      ...landingPage,
      heroSection: {
        ...landingPage.heroSection,
        backgroundImage: landingPage.heroSection.backgroundImage
          ? {
              raw: landingPage.heroSection.backgroundImage.asset.url,
              main: urlFor(landingPage.heroSection.backgroundImage)
                  
                  .fit("fill")
                  .quality(98)
                  .format("webp")
                  .url(),
              thumbnail: urlFor(landingPage.heroSection.backgroundImage)
            
                  .fit("crop")
                  .quality(80)
                  .format("webp")
                  .url(),
              medium: urlFor(landingPage.heroSection.backgroundImage)
                 
                  .fit("fill")
                  .quality(80)
                  .format("webp")
                  .url(),
            }
          : null,
      },
      featuresSection: {
        ...landingPage.featuresSection,
        features: landingPage.featuresSection.features.map((feature: any) => ({
          ...feature,
          icon: feature.icon
            ? {
                main: urlFor(feature.icon)
                    .width(100)
                    .height(100)
                    .fit("crop")
                    .quality(80)
                    .format("webp")
                    .url(),
                thumbnail: urlFor(feature.icon)
                    .width(50)
                    .height(50)
                    .fit("crop")
                    .quality(80)
                    .format("webp")
                    .url(),
                medium: urlFor(feature.icon)
                    .width(75)
                    .height(75)
                    .fit("crop")
                    .quality(80)
                    .format("webp")
                    .url(),
              }
            : null,
        })),
      },
      benefitsSection: {
        ...landingPage.benefitsSection,
        image: landingPage.benefitsSection.image
          ? {
              main: urlFor(landingPage.benefitsSection.image)
              .width(300)
                  .height(600)
                  .quality(80)
                  .url(),
              thumbnail: urlFor(landingPage.benefitsSection.image)
                  .width(300)
                  .height(200)
                  .fit("crop")
                  .quality(80)
                  .format("webp")
                  .url(),
              medium: urlFor(landingPage.benefitsSection.image)
                  .width(600)
                  .height(400)
                  .fit("crop")
                  .quality(80)
                  .format("webp")
                  .url(),
            }
          : null,
      },
      testimonialsSection: {
        ...landingPage.testimonialsSection,
        testimonials: landingPage.testimonialsSection.testimonials.map((testimonial: any) => ({
          ...testimonial,
          image: testimonial.image
            ? {
                main: urlFor(testimonial.image)
                    .width(100)
                    .height(100)
                    .fit("crop")
                    .quality(80)
                    .format("webp")
                    .url(),
                thumbnail: urlFor(testimonial.image)
                    .width(50)
                    .height(50)
                    .fit("crop")
                    .quality(80)
                    .format("webp")
                    .url(),
                medium: urlFor(testimonial.image)
                    .width(75)
                    .height(75)
                    .fit("crop")
                    .quality(80)
                    .format("webp")
                    .url(),
              }
            : null,
        })),
        sectionImage: landingPage.testimonialsSection.sectionImage
          ? {
              main: urlFor(landingPage.testimonialsSection.sectionImage)
                  .width(1200)
                  .height(630)
                  .fit("crop")
                  .quality(80)
                  .format("webp")
                  .url(),
              thumbnail: urlFor(landingPage.testimonialsSection.sectionImage)
                  .width(300)
                  .height(200)
                  .fit("crop")
                  .quality(80)
                  .format("webp")
                  .url(),
              medium: urlFor(landingPage.testimonialsSection.sectionImage)
                  .width(600)
                  .height(400)
                  .fit("crop")
                  .quality(80)
                  .format("webp")
                  .url(),
            }
          : null,
      },
    };

    elizaLogger.debug("[CLIENT-DIRECT] Fetched landing page from Sanity", {
      title: landingPage.title,
    });

    res.json({ landingPage: formattedLandingPage });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching landing page:", error);
    res.status(500).json({ error: "[CLIENT-DIRECT] Failed to fetch landing page", details: error.message });
  }
});



// Fetch legal documents (all or by slug)
// GET /legal-documents/:slug?
// If slug is provided, fetch a single legal document by slug
router.get("/legal-documents/:slug?", async (req, res) => {
  
  const { slug }: { slug?: string } = req.params;
  try {
    
    let query;
    let params = {};

    if (slug) {
      // Fetch a single legal document by slug
      query = `*[_type == "legalDocument" && slug.current == $slug && published == true][0] {
        title,
        slug,
        content,
        lastUpdated,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        }
      }`;
      params = { slug };
    } else {
      // Fetch all legal documents
      query = `*[_type == "legalDocument" && published == true] | order(title asc) {
        title,
        slug,
        lastUpdated,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        }
      }`;
    }

    const legalDocuments = await sanityClient.fetch(query, params);

    if (!legalDocuments) {
      elizaLogger.warn(`[CLIENT-DIRECT] No legal document${slug ? ` for slug: ${slug}` : "s"} found in Sanity`);
      return res.status(404).json({ error: `[CLIENT-DIRECT] No legal document${slug ? ` for slug: ${slug}` : "s"} found` });
    }

    // Format response to match LegalDocument interface
    const formattedLegalDocuments = Array.isArray(legalDocuments)
      ? legalDocuments.map((doc) => ({
          ...doc,
          slug: doc.slug?.current || doc.slug, // Ensure slug is string
          mainImage: doc.mainImage?.asset?.url
            ? urlFor(doc.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: doc.mainImage?.alt || doc.title,
        }))
      : {
          ...legalDocuments,
          slug: legalDocuments.slug?.current || legalDocuments.slug, // Ensure slug is string
          mainImage: legalDocuments.mainImage?.asset?.url
            ? urlFor(legalDocuments.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: legalDocuments.mainImage?.alt || legalDocuments.title,
        };

    elizaLogger.debug(`[CLIENT-DIRECT] Fetched legal document${slug ? ` for slug: ${slug}` : "s"} from Sanity`, {
      count: Array.isArray(legalDocuments) ? legalDocuments.length : 1,
    });

    res.json({ legalDocuments: formattedLegalDocuments });
  } catch (error: any) {
    elizaLogger.error(`[CLIENT-DIRECT] Error fetching legal document${slug ? ` for slug: ${slug}` : "s"}:`, error);
    res.status(500).json({ error: `[CLIENT-DIRECT] Failed to fetch legal document${slug ? ` for slug: ${slug}` : "s"}`, details: error.message });
  }
});



// Fetch blog posts (all or by slug)
// GET /blog-posts/:slug?
router.get("/blog-posts/:slug?", async (req, res) => {

  const { slug }: { slug?: string } = req.params;
  try {
    let query;
    let params = {};

    if (slug) {
      query = `*[_type == "blogPost" && slug.current == $slug && published == true][0] {
        title,
        slug,
        content[] {
          ...,
          _type == "image" => {
            ...,
            asset-> {
              _id,
              url
            }
          },
          _type == 'table' => {
          ...,
          caption,
          columns[] {
            content[] {
              ...,
              children[] {
                ...,
                _type == 'span' => {
                  ...,
                  marks[]
                }
              }
            },
            align,
            width
            },
            rows[] {
              cells[] {
                content[] {
                  ...,
                  children[] {
                    ...,
                    _type == 'span' => {
                      ...,
                      marks[]
                    }
                  }
                },
                colspan,
                rowspan,
                align
              }
            }
          }
        },
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        galleryImages[] {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags,
        adSlotHeader,
        adSlotContent,
        adSlotRightSide,
        relatedContent[0..2]-> {
          _type,
          title,
          slug,
          excerpt,
          mainImage {
            asset-> {
              _id,
              url
            },
            alt
          }
        }
      }`;
      params = { slug };
    } else {
      query = `*[_type == "blogPost" && published == true] | order(publishedAt desc) {
        title,
        slug,
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags,
        adSlotIndex
      }`;
    }

    const blogPosts = await sanityClient.fetch(query, params);

    if (!blogPosts) {
      elizaLogger.warn(`[CLIENT-DIRECT] No blog post${slug ? ` for slug: ${slug}` : "s"} found in Sanity`);
      return res.status(404).json({ error: `[CLIENT-DIRECT] No blog post${slug ? ` for slug: ${slug}` : "s"} found` });
    }

    const formattedBlogPosts = Array.isArray(blogPosts)
      ? blogPosts.map((post) => ({
          ...post,
          slug: post.slug?.current || post.slug, // Ensure slug is string
          mainImage: post.mainImage?.asset?.url
            ? urlFor(post.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: post.mainImage?.alt || post.title,
          heroImage: post.heroImage?.asset?.url
            ? urlFor(post.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: post.heroImage?.alt || post.title,
          galleryImages: post.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || post.title,
          })).filter((img) => img.url),
          thumbnailImage: post.thumbnailImage?.asset?.url
            ? urlFor(post.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: post.mediumImage?.asset?.url
            ? urlFor(post.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          adSlotIndex: post.adSlotIndex || null,
          relatedContent: post.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug, // Ensure slug is string
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        }))
      : {
          ...blogPosts,
          slug: blogPosts.slug?.current || blogPosts.slug, // Ensure slug is string
          mainImage: blogPosts.mainImage?.asset?.url
            ? urlFor(blogPosts.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: blogPosts.mainImage?.alt || blogPosts.title,
          heroImage: blogPosts.heroImage?.asset?.url
            ? urlFor(blogPosts.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: blogPosts.heroImage?.alt || blogPosts.title,
          galleryImages: blogPosts.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || blogPosts.title,
          })).filter((img) => img.url),
          thumbnailImage: blogPosts.thumbnailImage?.asset?.url
            ? urlFor(blogPosts.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: blogPosts.mediumImage?.asset?.url
            ? urlFor(blogPosts.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          adSlotHeader: blogPosts.adSlotHeader || null,
          adSlotContent: blogPosts.adSlotContent || null,
          adSlotRightSide: blogPosts.adSlotRightSide || null,
          relatedContent: blogPosts.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug, // Ensure slug is string
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        };

    elizaLogger.debug(`[CLIENT-DIRECT] Fetched blog post${slug ? ` for slug: ${slug}` : "s"} from Sanity`, {
      count: Array.isArray(blogPosts) ? blogPosts.length : 1,
    });

    res.json({ blogPosts: formattedBlogPosts });
  } catch (error: any) {
    elizaLogger.error(`[CLIENT-DIRECT] Error fetching blog post${slug ? ` for slug: ${slug}` : "s"}:`, error);
    res.status(500).json({ error: `[CLIENT-DIRECT] Failed to fetch blog post${slug ? ` for slug: ${slug}` : "s"}`, details: error.message });
  }
});



// Fetch docs (all or by slug)
// GET /docs/:slug?
router.get("/docs/:slug?", async (req, res) => {

  const { slug }: { slug?: string } = req.params;
  try {
    let query;
    let params = {};

    if (slug) {
      query = `*[_type == "doc" && slug.current == $slug && published == true][0] {
        title,
        slug,
        sortOrder,
        content[] {
          ...,
          _type == "image" => {
            ...,
            asset-> {
              _id,
              url
            }
          }
        },
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        galleryImages[] {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags,
        relatedContent[0..2]-> {
          _type,
          title,
          slug,
          excerpt,
          mainImage {
            asset-> {
              _id,
              url
            },
            alt
          }
        }
      }`;
      params = { slug };
    } else {
      query = `*[_type == "doc" && published == true] | order(publishedAt desc) {
  title,
  slug,
  sortOrder,
  content[] {
    ...,
    _type == "block" => {
      _key,
      style,
      children[] {
        _key,
        _type,
        text,
        marks
      },
      markDefs
    },
    _type == "image" => {
      _key,
      asset-> {
        _id,
        url
      },
      alt
    }
  },
  publishedAt,
  modifiedAt,
  seoDescription,
  excerpt,
  mainImage {
    asset-> {
      _id,
      url
    },
    alt
  },
  heroImage {
    asset-> {
      _id,
      url
    },
    alt
  },
  thumbnailImage {
    asset-> {
      _id,
      url
    }
  },
  mediumImage {
    asset-> {
      _id,
      url
    }
  },
  tags,
  relatedContent[0..2]-> {
    _type,
    title,
    slug,
    excerpt,
    mainImage {
      asset-> {
        _id,
        url
      },
      alt
    }
  }
}`;
    }

    const docs = await sanityClient.fetch(query, params);

    if (!docs) {
      elizaLogger.warn(`[CLIENT-DIRECT] No doc${slug ? ` for slug: ${slug}` : "s"} found in Sanity`);
      return res.status(404).json({ error: `[CLIENT-DIRECT] No doc${slug ? ` for slug: ${slug}` : "s"} found` });
    }

    const formattedDocs = Array.isArray(docs)
      ? docs.map((doc) => ({
          ...doc,
          slug: doc.slug?.current || doc.slug,
          mainImage: doc.mainImage?.asset?.url
            ? urlFor(doc.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: doc.mainImage?.alt || doc.title,
          heroImage: doc.heroImage?.asset?.url
            ? urlFor(doc.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: doc.heroImage?.alt || doc.title,
          galleryImages: doc.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || doc.title,
          })).filter((img) => img.url),
          thumbnailImage: doc.thumbnailImage?.asset?.url
            ? urlFor(doc.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: doc.mediumImage?.asset?.url
            ? urlFor(doc.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          relatedContent: doc.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug,
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        }))
      : {
          ...docs,
          slug: docs.slug?.current || docs.slug,
          mainImage: docs.mainImage?.asset?.url
            ? urlFor(docs.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: docs.mainImage?.alt || docs.title,
          heroImage: docs.heroImage?.asset?.url
            ? urlFor(docs.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: docs.heroImage?.alt || docs.title,
          galleryImages: docs.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || docs.title,
          })).filter((img) => img.url),
          thumbnailImage: docs.thumbnailImage?.asset?.url
            ? urlFor(docs.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: docs.mediumImage?.asset?.url
            ? urlFor(docs.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          relatedContent: docs.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug,
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        };

    elizaLogger.debug(`[CLIENT-DIRECT] Fetched doc${slug ? ` for slug: ${slug}` : "s"} from Sanity`, {
      count: Array.isArray(docs) ? docs.length : 1,
    });

    res.json({ docs: formattedDocs });
  } catch (error: any) {
    elizaLogger.error(`[CLIENT-DIRECT] Error fetching doc${slug ? ` for slug: ${slug}` : "s"}:`, error);
    res.status(500).json({ error: `[CLIENT-DIRECT] Failed to fetch doc${slug ? ` for slug: ${slug}` : "s"}`, details: error.message });
  }
});



// Fetch press posts (all or by slug)
// GET /press-posts/:slug?
router.get("/press-posts/:slug?", async (req, res) => {

  const { slug }: { slug?: string } = req.params;
  try {

    let query;
    let params = {};

    if (slug) {
      query = `*[_type == "pressPost" && slug.current == $slug && published == true][0] {
        title,
        slug,
        content[] {
          ...,
          _type == "image" => {
            ...,
            asset-> {
              _id,
              url
            }
          }
        },
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        galleryImages[] {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags,
        relatedContent[0..2]-> {
          _type,
          title,
          slug,
          excerpt,
          mainImage {
            asset-> {
              _id,
              url
            },
            alt
          }
        }
      }`;
      params = { slug };
    } else {
      query = `*[_type == "pressPost" && published == true] | order(publishedAt desc) {
        title,
        slug,
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags
      }`;
    }

    const pressPosts = await sanityClient.fetch(query, params);

    if (!pressPosts) {
      elizaLogger.warn(`[CLIENT-DIRECT] No press post${slug ? ` for slug: ${slug}` : "s"} found in Sanity`);
      return res.status(404).json({ error: `[CLIENT-DIRECT] No press post${slug ? ` for slug: ${slug}` : "s"} found` });
    }

    const formattedPressPosts = Array.isArray(pressPosts)
      ? pressPosts.map((post) => ({
          ...post,
          slug: post.slug?.current || post.slug, // Ensure slug is string
          mainImage: post.mainImage?.asset?.url
            ? urlFor(post.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: post.mainImage?.alt || post.title,
          heroImage: post.heroImage?.asset?.url
            ? urlFor(post.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: post.heroImage?.alt || post.title,
          galleryImages: post.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || post.title,
          })).filter((img) => img.url) || [],
          thumbnailImage: post.thumbnailImage?.asset?.url
            ? urlFor(post.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: post.mediumImage?.asset?.url
            ? urlFor(post.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          relatedContent: post.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug, // Ensure slug is string
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        }))
      : {
          ...pressPosts,
          slug: pressPosts.slug?.current || pressPosts.slug, // Ensure slug is string
          mainImage: pressPosts.mainImage?.asset?.url
            ? urlFor(pressPosts.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: pressPosts.mainImage?.alt || pressPosts.title,
          heroImage: pressPosts.heroImage?.asset?.url
            ? urlFor(pressPosts.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: pressPosts.heroImage?.alt || pressPosts.title,
          galleryImages: pressPosts.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || pressPosts.title,
          })).filter((img) => img.url) || [],
          thumbnailImage: pressPosts.thumbnailImage?.asset?.url
            ? urlFor(pressPosts.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: pressPosts.mediumImage?.asset?.url
            ? urlFor(pressPosts.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          relatedContent: pressPosts.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug, // Ensure slug is string
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        };

    elizaLogger.debug(`[CLIENT-DIRECT] Fetched press post${slug ? ` for slug: ${slug}` : "s"} from Sanity`, {
      count: Array.isArray(pressPosts) ? pressPosts.length : 1,
    });

    res.json({ pressPosts: formattedPressPosts });
  } catch (error: any) {
    elizaLogger.error(`[CLIENT-DIRECT] Error fetching press post${slug ? ` for slug: ${slug}` : "s"}:`, error);
    res.status(500).json({ error: `[CLIENT-DIRECT] Failed to fetch press post${slug ? ` for slug: ${slug}` : "s"}`, details: error.message });
  }
});



// Fetch company pages (all or by slug)
// GET /company-pages/:slug?
// As company pages are relatively simple, we can keep this endpoint straightforward
router.get("/company-pages/:slug?", async (req, res) => {

  const { slug }: { slug?: string } = req.params;
  try {

    let query;
    let params = {};

    if (slug) {
      // Fetch a single company page by slug
      query = `*[_type == "companyPage" && slug.current == $slug && published == true][0] {
        title,
        slug,
        content[] {
          ...,
          _type == "image" => {
            ...,
            asset-> {
              _id,
              url
            }
          }
        },
        lastUpdated,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        }
      }`;
      params = { slug };
    } else {
      // Fetch all company pages
      query = `*[_type == "companyPage" && published == true] | order(title asc) {
        title,
        slug,
        content[] {
          ...,
          _type == "image" => {
            ...,
            asset-> {
              _id,
              url
            }
          }
        },
        lastUpdated,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        }
      }`;
    }

    const companyPages = await sanityClient.fetch(query, params);

    if (!companyPages) {
      elizaLogger.warn(`[CLIENT-DIRECT] No company page${slug ? ` for slug: ${slug}` : "s"} found in Sanity`);
      return res.status(404).json({ error: `[CLIENT-DIRECT] No company page${slug ? ` for slug: ${slug}` : "s"} found` });
    }

    // Format response to match CompanyPage interface
    const formattedCompanyPages = Array.isArray(companyPages)
      ? companyPages.map((page) => ({
          ...page,
          slug: page.slug?.current || page.slug, // Ensure slug is string
          mainImage: page.mainImage?.asset?.url
            ? urlFor(page.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: page.mainImage?.alt || page.title,
        }))
      : {
          ...companyPages,
          slug: companyPages.slug?.current || companyPages.slug, // Ensure slug is string
          mainImage: companyPages.mainImage?.asset?.url
            ? urlFor(companyPages.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: companyPages.mainImage?.alt || companyPages.title,
        };

    elizaLogger.debug(`[CLIENT-DIRECT] Fetched company page${slug ? ` for slug: ${slug}` : "s"} from Sanity`, {
      count: Array.isArray(companyPages) ? companyPages.length : 1,
    });

    res.json({ companyPages: formattedCompanyPages });
  } catch (error: any) {
    elizaLogger.error(`[CLIENT-DIRECT] Error fetching company page${slug ? ` for slug: ${slug}` : "s"}:`, error);
    res.status(500).json({ error: `[CLIENT-DIRECT] Failed to fetch company page${slug ? ` for slug: ${slug}` : "s"}`, details: error.message });
  }
});



// Fetch product pages (all or by slug)
// GET /product-pages/:slug?
// Product pages can be more detailed, so we include additional fields
router.get("/product-pages/:slug?", async (req, res) => {

  const { slug }: { slug?: string } = req.params;
  try {
    let query;
    let params = {};

    if (slug) {
      query = `*[_type == "productPage" && slug.current == $slug && published == true][0] {
        title,
        slug,
        content[] {
          ...,
          _type == "image" => {
            ...,
            asset-> {
              _id,
              url
            }
          }
        },
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        galleryImages[] {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags,
        relatedContent[0..2]-> {
          _type,
          title,
          slug,
          excerpt,
          mainImage {
            asset-> {
              _id,
              url
            },
            alt
          }
        }
      }`;
      params = { slug };
    } else {
      query = `*[_type == "productPage" && published == true] | order(publishedAt desc) {
        title,
        slug,
        publishedAt,
        modifiedAt,
        seoDescription,
        excerpt,
        mainImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        heroImage {
          asset-> {
            _id,
            url
          },
          alt
        },
        thumbnailImage {
          asset-> {
            _id,
            url
          }
        },
        mediumImage {
          asset-> {
            _id,
            url
          }
        },
        tags,
        relatedContent[0..2]-> {
          _type,
          title,
          slug,
          excerpt,
          mainImage {
            asset-> {
              _id,
              url
            },
            alt
          }
        }
      }`;
    }

    const productPages = await sanityClient.fetch(query, params);

    if (!productPages) {
      elizaLogger.warn(`[CLIENT-DIRECT] No product page${slug ? ` for slug: ${slug}` : "s"} found in Sanity`);
      return res.status(404).json({ error: `[CLIENT-DIRECT] No product page${slug ? ` for slug: ${slug}` : "s"} found` });
    }

    const formattedProductPages = Array.isArray(productPages)
      ? productPages.map((page) => ({
          ...page,
          slug: page.slug?.current || page.slug, // Ensure slug is string
          mainImage: page.mainImage?.asset?.url
            ? urlFor(page.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: page.mainImage?.alt || page.title,
          heroImage: page.heroImage?.asset?.url
            ? urlFor(page.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: page.heroImage?.alt || page.title,
          galleryImages: page.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || page.title,
          })).filter((img) => img.url) || [],
          thumbnailImage: page.thumbnailImage?.asset?.url
            ? urlFor(page.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: page.mediumImage?.asset?.url
            ? urlFor(page.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          relatedContent: page.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug, // Ensure slug is string
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        }))
      : {
          ...productPages,
          slug: productPages.slug?.current || productPages.slug, // Ensure slug is string
          mainImage: productPages.mainImage?.asset?.url
            ? urlFor(productPages.mainImage.asset).width(1200).height(630).fit("crop").quality(80).format("webp").url()
            : null,
          mainImageAlt: productPages.mainImage?.alt || productPages.title,
          heroImage: productPages.heroImage?.asset?.url
            ? urlFor(productPages.heroImage.asset).width(1200).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          heroImageAlt: productPages.heroImage?.alt || productPages.title,
          galleryImages: productPages.galleryImages?.map((img) => ({
            url: img.asset?.url
              ? urlFor(img.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
              : null,
            alt: img.alt || productPages.title,
          })).filter((img) => img.url) || [],
          thumbnailImage: productPages.thumbnailImage?.asset?.url
            ? urlFor(productPages.thumbnailImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
            : null,
          mediumImage: productPages.mediumImage?.asset?.url
            ? urlFor(productPages.mediumImage.asset).width(600).height(400).fit("crop").quality(80).format("webp").url()
            : null,
          relatedContent: productPages.relatedContent?.map((item) => ({
            _type: item._type,
            title: item.title,
            slug: item.slug?.current || item.slug, // Ensure slug is string
            excerpt: item.excerpt || "",
            mainImage: item.mainImage?.asset?.url
              ? urlFor(item.mainImage.asset).width(300).height(200).fit("crop").quality(80).format("webp").url()
              : null,
            mainImageAlt: item.mainImage?.alt || item.title,
          })) || [],
        };

    elizaLogger.debug(`[CLIENT-DIRECT] Fetched product page${slug ? ` for slug: ${slug}` : "s"} from Sanity`, {
      count: Array.isArray(productPages) ? productPages.length : 1,
    });

    res.json({ productPages: formattedProductPages });
  } catch (error: any) {
    elizaLogger.error(`[CLIENT-DIRECT] Error fetching product page${slug ? ` for slug: ${slug}` : "s"}:`, error);
    res.status(500).json({ error: `[CLIENT-DIRECT] Failed to fetch product page${slug ? ` for slug: ${slug}` : "s"}`, details: error.message });
  }
});



// Generate sitemap.xml
// GET /sitemap.xml
// This endpoint generates a sitemap.xml including static routes and dynamic content from Sanity
// It adheres to the sitemap protocol: https://www.sitemaps.org/protocol.html
const staticRoutes = [
  { path: "/", changefreq: "hourly", priority: 1.0 },
  { path: "/demo", changefreq: "daily", priority: 0.8 },
  { path: "/company/blog", changefreq: "daily", priority: 0.8 },
  { path: "/company/press", changefreq: "daily", priority: 0.8 },
  { path: "/company/docs", changefreq: "daily", priority: 0.8 },
  { path: "/company/contact-us", changefreq: "daily", priority: 0.8 },
  { path: "/company/legal", changefreq: "weekly", priority: 0.8 },
];
router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = process.env.SERVER_URL; // Align with other endpoints

    // Fetch all blog posts
    const blogPosts = await sanityClient.fetch(
      `*[_type == "blogPost" && defined(slug.current) && published == true] { slug, publishedAt, modifiedAt }`
    );

    // Fetch all press posts
    const pressPosts = await sanityClient.fetch(
      `*[_type == "pressPost" && defined(slug.current) && published == true] { slug, publishedAt, modifiedAt }`
    );

    // Fetch all company pages
    const companyPages = await sanityClient.fetch(
      `*[_type == "companyPage" && defined(slug.current)] { slug, lastUpdated }`
    );

    // Fetch all legal documents
    const legalDocuments = await sanityClient.fetch(
      `*[_type == "legalDocument" && defined(slug.current)] { slug, lastUpdated }`
    );

    // Fetch all product pages
    const productPages = await sanityClient.fetch(
      `*[_type == "productPage" && defined(slug.current) && published == true] { slug, publishedAt, modifiedAt }`
    );

    // Fetch all docs
    const docs = await sanityClient.fetch(
      `*[_type == "doc" && defined(slug.current) && published == true] { slug, publishedAt, modifiedAt }`
    );

    const currentDate = new Date().toISOString();

    const formatLastmod = (modifiedAt: string | undefined, publishedAt: string | undefined) =>
      modifiedAt && !isNaN(new Date(modifiedAt).getTime())
        ? new Date(modifiedAt).toISOString()
        : publishedAt && !isNaN(new Date(publishedAt).getTime())
        ? new Date(publishedAt).toISOString()
        : currentDate;

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  ${staticRoutes
    .map(
      (route) => `
  <url>
    <loc>${baseUrl}${route.path}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
    )
    .join("")}
  ${blogPosts
    .map(
      (post: any) => `
  <url>
    <loc>${baseUrl}/company/blog/${post.slug.current}</loc>
    <lastmod>${formatLastmod(post.modifiedAt, post.publishedAt)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("")}
  ${pressPosts
    .map(
      (post: any) => `
  <url>
    <loc>${baseUrl}/company/press/${post.slug.current}</loc>
    <lastmod>${formatLastmod(post.modifiedAt, post.publishedAt)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("")}
  ${companyPages
    .map(
      (page: any) => `
  <url>
    <loc>${baseUrl}/company/${page.slug.current}</loc>
    <lastmod>${formatLastmod(page.lastUpdated, undefined)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join("")}
  ${legalDocuments
    .map(
      (doc: any) => `
  <url>
    <loc>${baseUrl}/legal/${doc.slug.current}</loc>
    <lastmod>${formatLastmod(doc.lastUpdated, undefined)}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join("")}
  ${productPages
    .map(
      (page: any) => `
  <url>
    <loc>${baseUrl}/product/${page.slug.current}</loc>
    <lastmod>${formatLastmod(page.modifiedAt, page.publishedAt)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("")}
  ${docs
    .map(
      (doc: any) => `
  <url>
    <loc>${baseUrl}/company/docs/${doc.slug.current}</loc>
    <lastmod>${formatLastmod(doc.modifiedAt, doc.publishedAt)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("")}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error generating sitemap:", error);
    res.status(500).json({ error: "Error generating sitemap", details: error.message });
  }
});



// Generate robots.txt
// GET /robots.txt
// This endpoint generates a robots.txt file to guide search engine crawlers
router.get("/robots.txt", async (req, res) => {
  try {
    const websiteDomain = process.env.WEBSITE_DOMAIN;
    
    const robots = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${websiteDomain}/api/sitemap.xml

# Crawl-delay (optional - adjust as needed)
Crawl-delay: 1

# Disallow certain paths if needed (uncomment and modify as required)
Disallow: /admin/
Disallow: /api/
Disallow: /auth
Disallow: /private/`;

    res.header("Content-Type", "text/plain");
    res.send(robots);
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error generating robots.txt:", error);
    res.status(500).send("Error generating robots.txt");
  }
});



// router.post('/characters/:characterId/email/reconnect', async (req, res) => {
//     const { characterId } = req.params;
//     const agentId = validateUuid(characterId);
//     if (!agentId) {
//         return res.status(400).json({ error: "Invalid character ID format" });
//     }
//     try {
//         const agentRuntime = agents.get(characterId);
//         if (!agentRuntime) {
//             return res.status(404).json({ error: "Character not found" });
//         }
//         const emailClient = agentRuntime.clients.find(c => c.type === 'email')?.client as EmailClient;
//         if (!emailClient) {
//             return res.status(404).json({ error: "Email service not found for character" });
//         }
//         const imapClient = emailClient.getImapClient();
//         if (imapClient && imapClient.isConnected) {
//             return res.json({ status: "already_connected" });
//         }
//         await emailClient.incomingEmailManager?.reset();
//         res.json({ status: "reconnected" });
//     } catch (error: any) {
//         elizaLogger.error(`[CLIENT-DIRECT] Failed to reconnect email for character ${characterId}`, {
//             error: error.message,
//             stack: error.stack,
//         });
//         res.status(500).json({ error: "Failed to reconnect email service" });
//     }
// });



router.get("");



// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------















































// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------
// ----------------------- STARKNET WALLET INTEGRATION ------------------------------
// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------



// Starknet contract address (from environment variable or default)
const VESU_CONTRACT = process.env.STARKNET_ADDRESS || "0x037ae3f583c8d644b7556c93a04b83b52fa96159b2b0cbd83c14d3122aef80a2";



// Rate limiter for wallet-related actions to prevent abuse 
const walletLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Max 5 wallet actions per window
});



// Apply rate limiter to wallet routes
router.use("/wallet", walletLimiter);



// Connect Starknet wallet to character
// POST /characters/:characterId/starknet-wallet
// Body: { walletType: string, zkProofHash: string, runesVerified: boolean } (runesVerified optional)
router.post("/characters/:characterId/starknet-wallet", requireAuth, requireActiveSubscription, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.userId;
    const { characterId } = req.params;
    const { walletType, zkProofHash, runesVerified } = req.body;

    if (!userId) {
      elizaLogger.warn("[CLIENT-DIRECT] No userId found in request for Starknet wallet creation");
      return res.status(401).json({ error: "Unauthorized: No user ID found" });
    }

    if (!walletType || !zkProofHash) {
      return res.status(400).json({ error: "walletType and zkProofHash are required" });
    }

    // Validate zkProofHash format
    if (!/^0x[0-9a-fA-F]{64}$/.test(zkProofHash)) {
      return res.status(400).json({ error: "zkProofHash must be a valid 32-byte keccak256 hash" });
    }

    // Verify character belongs to user
    const user = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const characterDoc = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: user._id }
    );
    if (!characterDoc) {
      return res.status(404).json({ error: "Character not found or access denied" });
    }

    // Check for existing Starknet wallet
    const existingWallet = await sanityClient.fetch(
      `*[_type == "StarknetWallet" && character._ref == $characterId][0]`,
      { characterId: characterDoc._id }
    );
    if (existingWallet) {
      return res.status(400).json({ error: "Starknet wallet already exists for this character" });
    }

    // Create Starknet wallet document
    const walletDoc = {
      _type: "StarknetWallet",
      character: { _type: "reference", _ref: characterDoc._id },
      walletType,
      zkProofHash,
      runesVerified: !!runesVerified,
      createdAt: new Date().toISOString(),
    };
    const createdWallet = await sanityClient.create(walletDoc);

    // Trigger agent follow-up message
    let runtime = agents.get(characterId);
    if (!runtime) {
      runtime = Array.from(agents.values()).find(
        (a) =>
          a.character.id === characterId ||
          a.character.name.toLowerCase() === characterId.toLowerCase() ||
          stringToUuid(a.character.name) === characterId
      );
    }
    if (!runtime) {
      elizaLogger.warn("[STARKNET_WALLET] Agent runtime not found for characterId:", characterId);
    } else {
      const roomId = stringToUuid(`default-room-${characterId}`);
      const userIdUuid = stringToUuid(userId);

      const successContent: Content = {
        text: `Your Starknet wallet was successfully connected. Connection verified with ZK proof. ${
          runesVerified ? "Runes verified." : "No Runes detected."
        }`,
        thought: "Starknet wallet connection confirmed",
        source: "CONNECT_STARKNET_WALLET",
        metadata: {
          action: "CONNECT_STARKNET_WALLET",
          zkProofHash,
          runesVerified,
        },
      };

      const successMemory: Memory = {
        id: stringToUuid(`STARKNET_WALLET_SUCCESS_${Date.now()}`),
        content: successContent,
        agentId: runtime.agentId,
        roomId,
        userId: userIdUuid,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(successMemory);
      elizaLogger.info("[STARKNET_WALLET] Follow-up success memory created:", { memoryId: successMemory.id });

      const state = await runtime.composeState(
        { content: successContent, userId: userIdUuid, roomId, agentId: runtime.agentId },
        {
          agentName: runtime.character.name,
          userId: userIdUuid,
          userName: user.name || "User",
        }
      );

      const messages: Content[] = [];

      await runtime.processActions(
        successMemory,
        [successMemory],
        state,
        async (newMessages) => {
          if (newMessages) {
            if (Array.isArray(newMessages)) {
              messages.push(...newMessages);
            } else {
              messages.push(newMessages);
            }
            elizaLogger.debug("[STARKNET_WALLET] Actions processed, new messages:", newMessages);
          }
          return [successMemory];
        }
      );

      await runtime.evaluate(successMemory, state);
      elizaLogger.debug("[STARKNET_WALLET] Success memory evaluated");
    }

    res.json({ wallet: createdWallet });
  } catch (error: any) {
    elizaLogger.error("[STARKNET_WALLET] Error storing Starknet wallet:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to store Starknet wallet", details: error.message });
  }
});



// Fetch Starknet wallet for character
// GET /characters/:characterId/starknet-wallet
router.get("/characters/:characterId/starknet-wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { characterId } = req.params;

    elizaLogger.debug("[CLIENT-DIRECT] Processing GET /characters/:characterId/starknet-wallet", { userId, characterId });

    // Verify access
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      elizaLogger.warn("[CLIENT-DIRECT] User not found", { userId });
      return res.status(404).json({ error: "User not found" });
    }

    const characterDoc = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!characterDoc) {
      elizaLogger.warn("[CLIENT-DIRECT] Character not found or access denied", { characterId, userId });
      return res.status(404).json({ error: "Character not found or access denied" });
    }

    // Get Starknet wallet
    const wallet = await sanityClient.fetch(
      `*[_type == "StarknetWallet" && character._ref == $characterId][0] {
        walletType,
        zkProofHash,
        runesVerified,
        createdAt
      }`,
      { characterId: characterDoc._id }
    );

    elizaLogger.debug("[CLIENT-DIRECT] Fetched Starknet wallet", { wallet, characterId });

    res.json({ wallet: wallet || null });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching Starknet wallet", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to fetch Starknet wallet", details: error.message });
  }
});



// Store wallet for character
// POST /characters/:characterId/wallet
// Self-Custodial wallet (called after Chipi creation)
router.post("/characters/:characterId/wallet", requireAuth, requireActiveSubscription, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { characterId } = req.params;
    const { txHash, publicKey } = req.body;

    if (!txHash || !publicKey) {
      return res.status(400).json({ error: "txHash and publicKey are required" });
    }

    // Verify character belongs to user
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      return res.status(404).json({ error: "User not found" });
    }

    const characterDoc = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!characterDoc) {
      return res.status(404).json({ error: "Character not found or access denied" });
    }

    // Check for existing wallet
    const existingWallet = await sanityClient.fetch(
      `*[_type == "Wallet" && character._ref == $characterId][0]`,
      { characterId: characterDoc._id }
    );
    if (existingWallet) {
      return res.status(400).json({ error: "Wallet already exists for this character" });
    }

    // Create wallet document
    const walletDoc = {
      _type: "Wallet",
      character: { _type: "reference", _ref: characterDoc._id },
      publicKey,
      txHash,
      createdAt: new Date().toISOString(),
    };
    const createdWallet = await sanityClient.create(walletDoc);

    // Patch character with walletPublicKey
    await sanityClient
      .patch(characterDoc._id)
      .set({ walletPublicKey: publicKey })
      .commit();

    // Trigger agent follow-up message
    let runtime = agents.get(characterId);
    if (!runtime) {
      runtime = Array.from(agents.values()).find(
        (a) =>
          a.character.id === characterId ||
          a.character.name.toLowerCase() === characterId.toLowerCase() ||
          stringToUuid(a.character.name) === characterId
      );
    }
    if (!runtime) {
      elizaLogger.warn("[STORE_WALLET] Agent runtime not found for characterId:", characterId);
    } else {
      const roomId = stringToUuid(`default-room-${characterId}`);
      const userIdUuid = stringToUuid(userId);

      const successContent: Content = {
        text: `Your wallet was successfully created. Your txHash is "${txHash}" and your publicKey is "${publicKey}".`,
        thought: "Wallet creation confirmed",
        source: "CREATE_CHIPI_WALLET",
        metadata: {
          action: "CREATE_CHIPI_WALLET",
          publicKey,
          txHash,
        },
      };

      const successMemory: Memory = {
        id: stringToUuid(`WALLET_SUCCESS_${Date.now()}`),
        content: successContent,
        agentId: runtime.agentId,
        roomId,
        userId: userIdUuid,
        createdAt: Date.now(),
      };

      await runtime.messageManager.createMemory(successMemory);
      elizaLogger.info("[STORE_WALLET] Follow-up success memory created:", { memoryId: successMemory.id });

      // Process the success memory through the agent's action pipeline
      const state = await runtime.composeState(
        { content: successContent, userId: userIdUuid, roomId, agentId: runtime.agentId },
        {
          agentName: runtime.character.name,
          userId: userIdUuid,
          userName: User.name || "User",
        }
      );

      const messages: Content[] = [];

      await runtime.processActions(
        successMemory,
        [successMemory],
        state,
        async (newMessages) => {
          if (newMessages) {
            if (Array.isArray(newMessages)) {
              messages.push(...newMessages);
            } else {
              messages.push(newMessages);
            }
            elizaLogger.debug("[STORE_WALLET] Actions processed, new messages:", newMessages);
          }
          return [successMemory];
        }
      );

      await runtime.evaluate(successMemory, state);
      elizaLogger.debug("[STORE_WALLET] Success memory evaluated");
    }

    res.json({ wallet: createdWallet });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error storing wallet:", error);
    res.status(500).json({ error: "Failed to store wallet", details: error.message });
  }
});



// Fetch wallet for character
// GET /characters/:characterId/wallet
router.get("/characters/:characterId/wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const { characterId } = req.params;

    // Verify access
    const User = await sanityClient.fetch(
      `*[_type == "User" && userId == $userId][0]`,
      { userId }
    );
    if (!User) {
      return res.status(404).json({ error: "User not found" });
    }

    const characterDoc = await sanityClient.fetch(
      `*[_type == "character" && id == $characterId && createdBy._ref == $userRef][0]`,
      { characterId, userRef: User._id }
    );
    if (!characterDoc) {
      return res.status(404).json({ error: "Character not found or access denied" });
    }

    // Get wallet
    const wallet = await sanityClient.fetch(
      `*[_type == "Wallet" && character._ref == $characterId][0] {
        publicKey,
        txHash,
        createdAt
      }`,
      { characterId: characterDoc._id }
    );

    res.json({ wallet: wallet || null });
  } catch (error: any) {
    elizaLogger.error("[CLIENT-DIRECT] Error fetching wallet:", error);
    res.status(500).json({ error: "Failed to fetch wallet", details: error.message });
  }
});




// async function getUserLimits(user: any): Promise<{ maxResponses: number; maxTokens: number }> {
//   const now = new Date();
//   if (user.subscriptionStatus === "active") {
//     const activePriceId = user.activePriceIds[0];
//     const plan = await sanityClient.fetch(
//       `*[_type == "Item" && stripePriceId == $activePriceId][0]`,
//       { activePriceId }
//     );
//     return {
//       maxResponses: plan.maxResponsesPerMonth,
//       maxTokens: plan.maxTokensPerMonth,
//     };
//   } else if (
//     user.subscriptionStatus === "trialing" &&
//     now >= new Date(user.trialStartDate) &&
//     now <= new Date(user.trialEndDate)
//   ) {
//     const basicPlan = await sanityClient.fetch(
//       `*[_type == "Item" && name == "Basic Plan"][0]`,
//       {}
//     );
//     return {
//       maxResponses: basicPlan.maxResponsesPerMonth,
//       maxTokens: basicPlan.maxTokensPerMonth,
//     };
//   }
//   return { maxResponses: 0, maxTokens: 0 };
// }



router.get("");



// ----------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------














  // Custom error handler
  router.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    elizaLogger.error("[CLIENT-DIRECT] Error:", err);
    res.status(500).json({ error: "[CLIENT-DIRECT] Internal server error" });
  });
    return router;
}
