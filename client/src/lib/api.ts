import type { UUID, Character, Plugin } from "@elizaos/core";
import { Clerk } from "@clerk/clerk-js";

// Base URL for API requests
const BASE_URL =
  import.meta.env.VITE_SERVER_BASE_URL ||
  `${import.meta.env.VITE_SERVER_URL}:${import.meta.env.VITE_SERVER_PORT}`;
console.log(`[FETCHER] Using BASE_URL: ${BASE_URL}`);

// Singleton Clerk instance
let clerkInstance: Clerk | null = null;

const initializeClerk = async () => {
  if (!clerkInstance) {
    clerkInstance = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
    try {
      await clerkInstance.load({}); // Initialize Clerk with session context
      console.log("[FETCHER] Clerk instance initialized");
    } catch (err) {
      console.error("[FETCHER] Failed to initialize Clerk:", err);
      throw err;
    }
  }
  return clerkInstance;
};

const fetcher = async ({
  url,
  method,
  body,
  headers,
}: {
  url: string;
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: object | FormData;
  headers?: HeadersInit;
}) => {
  // Prevent redirect loop if already on /auth
  if (
    window.location.pathname === "/auth" &&
    !url.startsWith("/api/auth") &&
    !url.startsWith("/api/user")
  ) {
    console.log(`[FETCHER] Aborting fetch: Already on auth page for ${url}`);
    throw new Error("Already on auth page, aborting fetch");
  }

  // --- Clerk token retrieval ---
  let accessToken: string | null = null;
  try {
    const clerk = await initializeClerk();
    if (clerk.session) {
      accessToken = await clerk.session.getToken();
      console.log("[FETCHER] Clerk token:", accessToken ? accessToken.substring(0, 10) + "..." : null);
    } else {
      console.log("[FETCHER] No active Clerk session");
    }
  } catch (err) {
    console.error("[FETCHER] Failed to get Clerk token:", err);
    if (!window.location.pathname.startsWith("/auth")) {
      window.location.href = "/auth";
    }
    throw new Error("No active session, please log in again");
  }

  const options: RequestInit = {
    method: method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    } as Record<string, string>,
    credentials: "include",
  };

  if (method === "POST" || method === "PATCH") {
    if (body instanceof FormData) {
      if (options.headers && typeof options.headers === "object") {
        options.headers = Object.fromEntries(
          Object.entries(options.headers as Record<string, string>).filter(
            ([key]) => key !== "Content-Type"
          )
        );
      }
      options.body = body;
      console.log(`[FETCHER] Preparing ${method} request with FormData body for ${url}`);
    } else {
      options.body = JSON.stringify(body);
      console.log(`[FETCHER] Preparing ${method} request with JSON body for ${url}:`, body);
    }
  }

  console.log(`[FETCHER] Sending request to ${BASE_URL}${url} with method: ${method}`);
  console.log(`[FETCHER] Fetching ${BASE_URL}${url} with headers:`, options.headers);

  const resp = await fetch(`${BASE_URL}${url}`, options);
  console.log(`[FETCHER] Response status for ${url}: ${resp.status}`);

  const contentType = resp.headers.get("Content-Type");
  if (contentType?.includes("audio/mpeg")) {
    console.log(`[FETCHER] Response is audio/mpeg for ${url}, returning blob`);
    return await resp.blob();
  }

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`[FETCHER] Fetch error for ${url}:`, errorText, "Status:", resp.status);

    let errorMessage = "An error occurred.";
    try {
      const errorObj = JSON.parse(errorText);
      errorMessage = errorObj.error || errorObj.message || errorText;
    } catch {
      errorMessage = errorText || "Unknown error";
    }

    const error = new Error(errorMessage);
    (error as any).status = resp.status;
    throw error;
  }

  if (resp.status === 204) {
    console.log(`[FETCHER] 204 No Content for ${url}, returning empty object`);
    return {};
  }

  console.log(`[FETCHER] Parsing response as JSON for ${url}`);
  return await resp.json();
};


export interface User {
  _id: string;
  userId: string;
  trialStartDate?: string;
  trialEndDate?: string;
  subscriptionStatus?: string;
  responseCount?: number;
  tokenCount?: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  activePlugins?: string[];
  activePriceIds?: string[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  hasUsedTrial?: boolean;
  cancelAtPeriodEnd?: boolean;
  signupSource: string;
}

interface CharacterInput {
  id: UUID;
  name: string;
  username?: string;
  system?: string;
  bio?: string[];
  lore?: string[];
  messageExamples: { user: string; content: { text: string; action?: string } }[][];
  postExamples?: string[];
  topics?: string[];
  adjectives?: string[];
  style?: { all?: string[]; chat?: string[]; post?: string[] };
  modelProvider?: "OPENAI" | "OLLAMA" | "CUSTOM";
  plugins?: string[];
  settings?: {
    secrets?: { dynamic?: Array<{ key: string; value: string }> };
    voice?: { model?: string };
    ragKnowledge?: boolean;
     email?: {
      outgoing?: {
        service?: "smtp" | "gmail";
        host?: string;
        port?: number;
        secure?: boolean;
        user?: string;
        pass?: string;
      };
      incoming?: {
        service?: "imap";
        host?: string;
        port?: number;
        user?: string;
        pass?: string;
      };
    };
  };
  knowledge?: Array<any>;
  profile?: { image?: string }; // Added profile field
  enabled?: boolean;
}


interface ImageVariants {
  main: string;
  thumbnail: string;
  medium: string;
  raw?: string; // Optional raw URL for the image
}

interface LandingPage {
  title: string;
  slug: { current: string };
  heroSection: {
    title: string;
    subtitle: string;
    primaryCtaText: string;
    secondaryCtaText?: string;
    trustSignal?: string;
    backgroundImage?: ImageVariants;
    mascotModel?: { asset: { _id: string; url: string } };
  };
  featuresSection: {
    heading: string;
    features: Array<{
      title: string;
      description: string;
      icon?: ImageVariants;
    }>;
    ctaText: string;
  };
  benefitsSection: {
    heading: string;
    description: string;
    benefitsList: string[];
    image: ImageVariants;
  };
  testimonialsSection: {
    heading: string;
    testimonials: Array<{
      quote: string;
      author: string;
      role: string;
      image?: ImageVariants;
    }>;
    trustSignal: string;
    sectionImage?: ImageVariants;
  };
  ctaSection: {
    heading: string;
    description: string;
    ctaText: string;
    ctaUrl?: string;
  };
  footerSection: {
    tagline: string;
    companyLinks: Array<{ label: string; url: string }>;
    productLinks: Array<{ label: string; url: string }>;
    legalLinks: Array<{ label: string; url: string }>;
    socialLinks: Array<{
      platform: string;
      url: string;
    }>;
  };
  subFooterSection: {
    ctaText: string;
    ctaUrl: string;
    copyright: string;
  };
  _updatedAt?: string;
}

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  itemType: string;
  features?: string[];
  isPopular?: boolean;
  trialInfo?: string;
  useCase?: string;
  source?: string; // Optional, since backend includes it
    pluginName?: string; // Added for plugin items
  stripePriceId?: string; // Added for base items
}



// Define shared Knowledge types
export interface ImageItem {
  imageAssetId: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
}

export interface Knowledge {
  _id: string;
  id: string;
  name: string;
  text: string;
  agentId: string;
  metadata?: {
    source?: string;
    type?: string;
    images?: ImageItem[];
    [key: string]: any;
  };
  createdAt: string;
}

export interface KnowledgeResponse {
  knowledge: Knowledge[];
}


interface EmailTemplate {
  _id: string;
  agentId: string;
  position: string;
  emailAddress: string;
  companyName: string;
  instructions: string;
  bestRegard: string;
}

export interface LegalDocument {
  title: string;
  slug: string;
  lastUpdated: string;
  content?: Array<any>;
  mainImage?: string;
  mainImageAlt?: string;
}

export interface BlogPost {
  title: string;
  slug: string;
  content?: Array<any>;
  publishedAt: string;
  modifiedAt?: string;
  seoDescription: string;
  excerpt: string;
  mainImage?: string;
  mainImageAlt?: string;
  heroImage?: string;
  heroImageAlt?: string;
  galleryImages?: Array<{ url: string; alt: string }>;
  thumbnailImage?: string;
  mediumImage?: string;
  tags?: string[];
  adSlotHeader?: string | null;
  adSlotContent?: string | null;
  adSlotRightSide?: string | null;
  adSlotIndex?: string | null;
  relatedContent?: Array<{
    _type: "blogPost" | "pressPost" | "productPage";
    title: string;
    slug: string;
    mainImage?: string;
    mainImageAlt?: string;
    excerpt: string;
  }>;
}

export interface Docs {
  _id: string;
  title: string;
  slug: string;
  sortOrder?: number;
  excerpt: string;
  seoDescription: string;
  publishedAt: string;
  modifiedAt?: string | null;
  mainImage?: string;
  mainImageAlt?: string;
  heroImage?: string;
  heroImageAlt?: string;
  thumbnailImage?: string | null;
  mediumImage?: string | null;
  tags?: string[] | null;
  relatedContent?: Array<{
    _type: string;
    slug: string;
    title: string;
    mainImage?: string;
    mainImageAlt?: string;
    excerpt?: string;
    publishedAt: string;
  }>;
  content?: Array<
    | {
        _key: string;
        _type: "block";
        style?: string;
        children?: Array<{
          _key: string;
          _type: string;
          text?: string;
          marks?: string[];
        }>;
        markDefs?: Array<any>;
      }
    | {
        _key: string;
        _type: "image";
        asset?: {
          url: string;
        };
        alt?: string;
      }
  >;
  galleryImages?: Array<{
    url: string;
    alt?: string;
  }>;
}

export interface PressPost {
  title: string;
  slug: string;
  content?: Array<any>;
  publishedAt: string;
  modifiedAt?: string;
  seoDescription: string;
  excerpt: string;
  mainImage?: string;
  mainImageAlt?: string;
  heroImage?: string;
  heroImageAlt?: string;
  galleryImages?: Array<{ url: string; alt: string }>;
  thumbnailImage?: string;
  mediumImage?: string;
  tags?: string[];
  relatedContent?: Array<{
    _type: "blogPost" | "pressPost" | "productPage";
    title: string;
    slug: string;
    excerpt?: string;
    mainImage?: string;
    mainImageAlt?: string;
    publishedAt: string;
  }>;
}

export interface CompanyPage {
  title: string;
  slug: string;
  lastUpdated: string;
  content?: Array<any>;
  mainImage?: string;
  mainImageAlt?: string;
}


export interface ProductPage {
  title: string;
  slug: string;
  content?: Array<any>;
  publishedAt: string;
  modifiedAt?: string;
  seoDescription: string;
  excerpt: string;
  mainImage?: string;
  mainImageAlt?: string;
  heroImage?: string;
  heroImageAlt?: string;
  galleryImages?: Array<{ url: string; alt: string }>;
  thumbnailImage?: string;
  mediumImage?: string;
  tags?: string[];
  relatedContent?: Array<{
    _type: "blogPost" | "pressPost" | "productPage";
    title: string;
    slug: string;
    excerpt?: string;
    mainImage?: string;
    mainImageAlt?: string;
    publishedAt: string;
  }>;
}



interface Invoice {
  _id: string;
  stripeInvoiceId: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  createdAt: string;
  dueDate: string | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lineItems: Array<{
    _key: string;
    description: string;
    amount: number;
    currency: string;
    quantity: number;
    period: { start: string | null; end: string | null };
    productName: string;
  }>;
}


export interface WalletData {
  publicKey: string;
  txHash: string;
  createdAt: string;
}


interface TransactionResponse {
  message: string;
  transactionHash: string;
}


// In api.ts
export interface CreateWalletResponse {
  success: boolean;
  wallet: {
    publicKey: string;
    encryptedPrivateKey: string;
    accountAddress?: string; // Make accountAddress optional to match reality
  };
  txHash: string;
  walletPublicKey?: string; // Add this if walletPublicKey is directly on the response
}
interface MessageParams {
  roomId?: string;
  count?: number;
  start?: number;
}

export interface Message {
  text: string;
  user: string;
  createdAt: number;
  source?: string;
  action?: string;
  metadata?: {
    imageAssetId?: string;
    emails?: any[];
    emailId?: string;
    pendingReply?: any;
    pendingChipiWalletConfirmation?: any;
    action?: string;
    promptConfirmation?: boolean;
    promptPin?: boolean;
    publicKey?: string;
    txHash?: string;
    wallets?: Array<{
      walletId: string;
      address?: string;
      balance?: string;
      status?: string;
      details?: string;
    }>;
  };
  attachments?: Array<{
    id: string;
    url: string;
    title: string;
    source: string;
    description: string;
    text: string;
    contentType: string;
  }>;
}


getUserStats: () => Promise<{ totalUsers: number; onlineUsers: number }>;

export const apiClient = {
  sendMessage: (
    agentId: string,
    message: string,
    selectedFile?: File | null,
    metadata?: { imageAssetId?: string },
  ) => {
    const formData = new FormData();
    formData.append("text", message);
    formData.append("user", "user");
    if (selectedFile) {
      formData.append("file", selectedFile);
    }
    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }
    return fetcher({
      url: `/api/${agentId}/message`,
      method: "POST",
      body: formData,
    });
  },

  getMessages: (agentId: string, params: MessageParams & { lastOnly?: boolean } = {}): Promise<Message[]> => {
    const query = new URLSearchParams({
      roomId: params.roomId || `default-room-${agentId}`,
      count: params.count?.toString() || "50",
      start: params.start?.toString() || (Date.now() - 24 * 60 * 60 * 1000).toString(),
      ...(params.lastOnly ? { lastOnly: "true" } : {}),
    }).toString();
    return fetcher({
      url: `/api/${agentId}/messages?${query}`,
      method: "GET",
    }).then((response) => {
      console.log("[API_CLIENT] getMessages response:", {
        agentId,
        messageCount: response.length,
        lastOnly: params.lastOnly,
        messages: response.map((msg: Message) => ({
          text: msg.text,
          user: msg.user,
          createdAt: msg.createdAt,
          source: msg.source,
          action: msg.metadata?.action,
          txHash: msg.metadata?.txHash,
          publicKey: msg.metadata?.publicKey,
        })),
      });
      return response;
    });
  },
  getAgents: () => {
    return fetcher({
      url: "/api/agents",
      method: "GET",
    });
  },

  getAgent: (agentId: string): Promise<{ id: UUID; character: Character }> =>
    fetcher({ url: `/api/agents/${agentId}` }),

  tts: (
  agentId: string,
  text: string,
  phraseReplacements?: Array<{ phrase: string; replacement: string }>
): Promise<Blob> =>
  fetcher({
    url: `/api/${agentId}/tts`,
    method: "POST",
    body: {
      text,
      ...(phraseReplacements && { phraseReplacements }),
    },
    headers: {
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
  }).then((response) => {
    console.log(`[API_CLIENT] TTS response for agentId ${agentId}:`, {
      type: response instanceof Blob ? "audio/mpeg" : "unknown",
      size: response instanceof Blob ? response.size : undefined,
    });
    if (!(response instanceof Blob)) {
      throw new Error("Expected audio/mpeg response, received invalid data");
    }
    return response;
  }).catch((error) => {
    console.error(`[API_CLIENT] TTS error for agentId ${agentId}:`, {
      message: error.message,
      status: error.status,
    });
    throw error;
  }),

  whisper: async (agentId: string, audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");
    return fetcher({
      url: `/${agentId}/whisper`,
      method: "POST",
      body: formData,
    });
  },

  createUser: async (user: Partial<User>) => {
    try {
      const clerk = await initializeClerk();
      if (!clerk.user) {
        throw new Error("No Clerk user found");
      }
      const response = await fetcher({
        url: "/api/user",
        method: "POST",
        body: {
          _type: "User",
          signupSource: user.signupSource || "Email Signup",
        },
      });
      return response.user;
    } catch (error: any) {
      console.error("[API_CLIENT] Error creating user:", error);
      throw new Error(error.message || "Failed to create or fetch user");
    }
  },

  getPlugins: (): Promise<{ plugins: Plugin[] }> => {
    return fetcher({
      url: "/api/plugins",
      method: "GET",
    });
  },

  async uploadCharacterProfileImage(characterId: UUID, formData: FormData) {
    return fetcher({
      url: `/api/characters/${characterId}/upload-profile-image`,
      method: "POST",
      body: formData,
    });
  },

  uploadAgentImage: (agentId: string, image: File, postTo?: string[]) => {
    const formData = new FormData();
    formData.append("image", image);
    if (postTo && postTo.length > 0) {
      formData.append("postTo", postTo.join(","));
    }
    return fetcher({
      url: `/api/${agentId}/upload-agent-image`,
      method: "POST",
      body: formData,
    });
  },

  getCharacters: () => {
    return fetcher({
      url: "/api/characters",
      method: "GET",
    });
  },

  getCharacter: (characterId: string): 
    Promise<{ 
      id: UUID; character: Character 
    }> =>
      fetcher({ url: `/api/characters/${characterId}` }),

  createCharacter: (character: CharacterInput) =>
    fetcher({
      url: "/api/characters",
      method: "POST",
      body: character,
    }),

  updateCharacter: (characterId: string, character: Partial<CharacterInput>) =>
    fetcher({
      url: `/api/characters/${characterId}`,
      method: "PATCH",
      body: character,
    }),

  getCharacterPresets: (): Promise<{ characterPresets: any[] }> => {
    return fetcher({
      url: "/api/character-presets",
      method: "GET",
    });
  },

  deleteCharacter: (characterId: string) =>
    fetcher({
      url: `/api/characters/${characterId}`,
      method: "DELETE",
    }),

  createCheckoutSession: (data: { userId: string; items: { id: string; name: string; description: string; price: number; itemType: string }[] }) => {
    return fetcher({
      url: "/api/checkout-session",
      method: "POST",
      body: data,
    });
  },

  getKnowledge: (agentId: string): Promise<KnowledgeResponse> =>
    fetcher({
      url: `/api/agents/${agentId}/knowledge`,
      method: "GET",
    }),
    
  createKnowledge: (agentId: string, knowledge: { name: string; text: string; metadata?: object }) =>
    fetcher({
      url: `/api/agents/${agentId}/knowledge`,
      method: "POST",
      body: knowledge,
    }),

  updateKnowledge: (agentId: string, knowledgeId: string, knowledge: { name?: string; text?: string; metadata?: object }) =>
    fetcher({
      url: `/api/agents/${agentId}/knowledge/${knowledgeId}`,
      method: "PATCH",
      body: knowledge,
    }),

  deleteKnowledge: (agentId: string, knowledgeId: string) =>
    fetcher({
      url: `/api/agents/${agentId}/knowledge/${knowledgeId}`,
      method: "DELETE",
    }),

  getUser: () => {
    return fetcher({
      url: "/api/user",
      method: "GET",
    });
  },

  getUserStats: () => {
    return fetcher({
      url: "/api/user-stats",
      method: "GET",
    });
  },
  
  getItems: ({ itemType }: { itemType?: string } = {}) => {
    let url = "/api/items";
    if (itemType && typeof itemType === "string" && itemType.trim() !== "") {
      url += `?itemType=${encodeURIComponent(itemType)}`;
    }
    return fetcher({
      url,
      method: "GET",
    }) as Promise<{ items: Item[] }>;
  },

  addPlugin: (pluginName: string) =>
    fetcher({
      url: "/api/subscription/add-plugin",
      method: "POST",
      body: { pluginName },
    }),

  removePlugin: (pluginName: string) =>
    fetcher({
      url: "/api/subscription/remove-plugin",
      method: "POST",
      body: { pluginName },
    }),

  updateBasePlan: (newBasePlanId: string) =>
    fetcher({
      url: "/api/subscription/update-base-plan",
      method: "POST",
      body: { newBasePlanId },
    }),

  getSubscriptionItems: ({ includeDetails }: { includeDetails?: boolean } = {}) => {
    return fetcher({
      url: `/api/subscription-items${includeDetails ? "?includeDetails=true" : ""}`,
      method: "GET",
    });
  },

  getSubscriptionStatus: () => {
    return fetcher({
      url: "/api/subscription-status",
      method: "GET",
    });
  },

  createPortalSession: () => {
    return fetcher({
      url: "/api/create-portal-session",
      method: "POST",
    });
  },

  cancelSubscription: () => {
    return fetcher({
      url: "/api/cancel-subscription",
      method: "POST",
    });
  },

  getLandingPage: (): Promise<{ landingPage: LandingPage }> => {
    return fetcher({
      url: "/api/landing-page",
      method: "GET",
    });
  },

  getEmailTemplate: (agentId: string) =>
    fetcher({
      url: `/api/agents/${agentId}/email-template`,
      method: "GET",
    }),

  updateEmailTemplate: (agentId: string, template: Partial<EmailTemplate>) =>
    fetcher({
      url: `/api/agents/${agentId}/email-template`,
      method: "PATCH",
      body: template,
    }),

  reconnectEmail: (characterId: string) =>
    fetcher({
        url: `/api/characters/${characterId}/email/reconnect`,
        method: "POST",
    }),

  updateConnectionStatus: (data: { isConnected: boolean }) =>
    fetcher({
      url: "/api/connection-status",
      method: "POST",
      body: data,
    }),

  getConnectionStatus: () =>
    fetcher({
      url: "/api/connection-status",
      method: "GET",
    }),

  getLegalDocuments: (): Promise<{ legalDocuments: LegalDocument[] }> => {
    return fetcher({
      url: "/api/legal-documents",
      method: "GET",
    });
  },

  getLegalDocumentBySlug: (slug: string): Promise<{ legalDocuments: LegalDocument }> => {
    return fetcher({
      url: `/api/legal-documents/${slug}`,
      method: "GET",
    });
  },

  getCompanyPages: (): Promise<{ companyPages: CompanyPage[] }> => {
    return fetcher({
      url: "/api/company-pages",
      method: "GET",
    });
  },

  getCompanyPageBySlug: (slug: string): Promise<{ companyPages: CompanyPage }> => {
    return fetcher({
      url: `/api/company-pages/${slug}`,
      method: "GET",
    });
  },

  getBlogPosts: (slug?: string): Promise<{ blogPosts: BlogPost | BlogPost[] }> => {
    return fetcher({
      url: slug ? `/api/blog-posts/${slug}` : "/api/blog-posts",
      method: "GET",
    });
  },

  getBlogPostBySlug: (slug: string): Promise<{ blogPosts: BlogPost }> => {
    return fetcher({
      url: `/api/blog-posts/${slug}`,
      method: "GET",
    });
  },

  getDocs: (slug?: string): Promise<{ docs: Docs | Docs[] }> => {
    return fetcher({
      url: slug ? `/api/docs/${slug}` : "/api/docs",
      method: "GET",
    });
  },

  getDocBySlug: (slug: string): Promise<{ docs: Docs }> => {
    return fetcher({
      url: `/api/docs/${slug}`,
      method: "GET",
    });
  },

  getPressPosts: (slug?: string): Promise<{ pressPosts: PressPost | PressPost[] }> => {
    return fetcher({
      url: slug ? `/api/press-posts/${slug}` : "/api/press-posts",
      method: "GET",
    });
  },

  getPressPostBySlug: (slug: string): Promise<{ pressPosts: PressPost }> => {
    return fetcher({
      url: `/api/press-posts/${slug}`,
      method: "GET",
    });
  },
  
  getProductPages: (slug?: string): Promise<{ productPages: ProductPage | ProductPage[] }> => {
    return fetcher({
      url: slug ? `/api/product-pages/${slug}` : "/api/product-pages",
      method: "GET",
    });
  },

  getProductPageBySlug: (slug: string): Promise<{ productPages: ProductPage }> => {
    return fetcher({
      url: `/api/product-pages/${slug}`,
      method: "GET",
    });
  },

  getInvoices: (): Promise<{ invoices: Invoice[]; subscriptionId: string | null }> => {
    console.log("[API_CLIENT] Calling getInvoices");
    return fetcher({
      url: "/api/invoices",
      method: "GET",
    }).then((response) => {
      console.log("[API_CLIENT] getInvoices response:", {
        invoiceCount: response.invoices.length,
        subscriptionId: response.subscriptionId,
        invoices: response.invoices.map((inv: Invoice) => ({
          stripeInvoiceId: inv.stripeInvoiceId,
          status: inv.status,
        })),
      });
      return response;
    });
  },

  getInvoiceBySessionId: async (sessionId: string) => {
    console.log("[API_CLIENT] Calling getInvoiceBySessionId", { sessionId });
    let token: string | null = null;
    try {
      const clerk = await initializeClerk();
      if (clerk.session) {
        token = await clerk.session.getToken();
      } else {
        console.log("[API_CLIENT] No active Clerk session for getInvoiceBySessionId");
      }
    } catch (err) {
      console.error("[API_CLIENT] Failed to get Clerk token for getInvoiceBySessionId:", err);
      throw new Error("No active session");
    }
    if (!token) {
      throw new Error("No active session");
    }

    return fetcher({
      url: `/api/invoice?sessionId=${encodeURIComponent(sessionId)}`,
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  },












getRecentMemories: (agentId: string, roomId: string) => {
  return fetcher({
    url: `/agents/${agentId}/${roomId}/memories`,
    method: "GET",
  }) as Promise<{
    agentId: string;
    roomId: string;
    memories: Array<{
      id: string;
      userId: string;
      agentId: string;
      createdAt: number;
      content: {
        text: string;
        action?: string;
        source?: string;
        url?: string;
        inReplyTo?: string;
        attachments?: Array<{
          id: string;
          url: string;
          title: string;
          source: string;
          description: string;
          text: string;
          contentType: string;
        }>;
        metadata?: any; // Ensure metadata is included
      };
      embedding: number[];
      roomId: string;
      unique?: boolean;
      similarity?: number;
    }>;
  }>;
},






  createWallet: async (
  encryptKey: string,
  externalUserId: string,
  tokens?: { sAccessToken?: string | null; sRefreshToken?: string | null }
): Promise<CreateWalletResponse> => {
  console.log("[API_CLIENT] Calling createWallet", {
    externalUserId,
    encryptKey: "[REDACTED]",
    tokens: {
      sAccessToken: tokens?.sAccessToken ? `[REDACTED_${tokens.sAccessToken.slice(-4)}]` : undefined,
      sRefreshToken: tokens?.sRefreshToken ? `[REDACTED_${tokens.sRefreshToken.slice(-4)}]` : undefined,
    },
  });

  return fetcher({
    url: "/api/createWallet",
    method: "POST",
    body: { encryptKey, externalUserId },
    headers: {
    },
  }).then((response: CreateWalletResponse) => {
    console.log("[API_CLIENT] createWallet response:", {
      success: response.success,
      wallet: {
        publicKey: response.wallet.publicKey,
        encryptedPrivateKey: response.wallet.encryptedPrivateKey
          ? `[TRUNCATED_${response.wallet.encryptedPrivateKey.slice(0, 10)}...]`
          : undefined,
      },
      txHash: response.txHash,
    });
    return response;
  });
},
  

storeWallet: (characterId: string, data: { txHash: string; publicKey: string; }): Promise<{ wallet: WalletData }> =>
  fetcher({
    url: `/api/characters/${characterId}/wallet`,
    method: "POST",
    body: data,
  }),

getWallet: (characterId: string): Promise<{ wallet: WalletData | null }> =>
  fetcher({
    url: `/api/characters/${characterId}/wallet`,
    method: "GET",
  }),

  storeStarknetWalletConnection: (agentId: string, data: { walletType: string; zkProofHash: string; runesVerified?: boolean }, accessToken: string): Promise<{ wallet: { walletType: string; zkProofHash: string; runesVerified?: boolean; createdAt: string } }> =>
  fetcher({
    url: `/api/characters/${agentId}/starknet-wallet`,
    method: "POST",
    body: data,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }),

  transferUSDC: (encryptKey: string, amount: string, recipient: string): Promise<TransactionResponse> =>
    fetcher({
      url: "/api/wallet/transfer",
      method: "POST",
      body: { encryptKey, amount, recipient },
    }),

  approveToken: (encryptKey: string, amount: string, contractAddress: string, spender: string): Promise<TransactionResponse> =>
    fetcher({
      url: "/api/wallet/approve",
      method: "POST",
      body: { encryptKey, amount, contractAddress, spender },
    }),

  stakeUSDC: (encryptKey: string, amount: string, recipient: string): Promise<TransactionResponse> =>
    fetcher({
      url: "/api/wallet/stake",
      method: "POST",
      body: { encryptKey, amount, recipient },
    }),

  withdrawUSDC: (encryptKey: string, amount: string, recipient: string): Promise<TransactionResponse> =>
    fetcher({
      url: "/api/wallet/withdraw",
      method: "POST",
      body: { encryptKey, amount, recipient },
    }),

  callContract: (encryptKey: string, contractAddress: string, entrypoint: string, calldata: string): Promise<TransactionResponse> =>
    fetcher({
      url: "/api/wallet/call-contract",
      method: "POST",
      body: { encryptKey, contractAddress, entrypoint, calldata },
    }),

    
};
// /**
//  * Provides an interface to get the current user's authentication token.
//  * This is a minimal implementation for use outside React components.
//  */
// function useAuth(): { getToken: () => Promise<string | null> } {
//   const clerk = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

//   return {
//     getToken: async () => {
//       try {
//         // If Clerk is loaded and session exists, get the token
//         if (clerk.session) {
//           return await clerk.session.getToken();
//         }
//         return null;
//       } catch (err) {
//         console.error("useAuth: Failed to get Clerk token", err);
//         return null;
//       }
//     },
//   };
// }

