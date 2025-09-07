import type { UUID, Character } from "@elizaos/core";
import Session from "supertokens-web-js/recipe/session";

const BASE_URL =
  import.meta.env.VITE_SERVER_BASE_URL ||
  `${import.meta.env.VITE_SERVER_URL}:${import.meta.env.VITE_SERVER_PORT}`;

console.log({ BASE_URL });

const fetcher = async ({
  url,
  method,
  body,
  headers,
  retries = 1,
}: {
  url: string;
  method?: "GET" | "POST" | "DELETE" | "PATCH";
  body?: object | FormData;
  headers?: HeadersInit;
  retries?: number;
}) => {
  // Prevent redirect loop if already on /auth, except for auth-related endpoints
  if (
    window.location.pathname === "/auth" &&
    !url.startsWith("/api/auth") &&
    !url.startsWith("/api/user")
  ) {
    console.log(`[FETCHER] Aborting fetch: Already on auth page for ${url}`);
    throw new Error("Already on auth page, aborting fetch");
  }

  const options: RequestInit = {
    method: method ?? "GET",
    headers: headers
      ? headers
      : {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
    credentials: "include",
  };

  if (method === "POST" || method === "PATCH"){
    if (body instanceof FormData) {
      if (options.headers && typeof options.headers === "object") {
        options.headers = Object.fromEntries(
          Object.entries(options.headers as Record<string, string>).filter(
            ([key]) => key !== "Content-Type"
          )
        );
      }
      options.body = body;
      console.log(`[FETCHER] Preparing POST request with FormData body for ${url}`);
    } else {
      options.body = JSON.stringify(body);
      console.log(`[FETCHER] Preparing POST request with JSON body for ${url}:`, body);
    }
  }

  // Add SuperTokens session headers
  try {
    const sessionToken = await Session.getAccessToken();
    if (sessionToken) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${sessionToken}`,
      };
      console.log(`[FETCHER] Authorization header added for ${url}`);
    }
  } catch (error) {
    console.warn(`[FETCHER] No session token available for ${url}:`, error);
  }

  console.log(`[FETCHER] Sending request to ${BASE_URL}${url} with method: ${method}`);
  console.log(`[FETCHER] Fetching ${BASE_URL}${url} with headers:`, options.headers);

  try {
    const resp = await fetch(`${BASE_URL}${url}`, options);
    console.log(`[FETCHER] Response status for ${url}: ${resp.status}`);
    console.log(`[FETCHER] Response headers for ${url}:`, {
      "access-control-allow-origin": resp.headers.get("access-control-allow-origin"),
      "access-control-allow-credentials": resp.headers.get("access-control-allow-credentials"),
    });

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
        if (resp.status === 401 && retries > 0) {
          console.log(`[FETCHER] 401 error for ${url}, attempting to refresh session`);
          await Session.attemptRefreshingSession();
          console.log(`[FETCHER] Session refreshed, retrying ${url}`);
          return fetcher({ url, method, body, headers, retries: retries - 1 });
        } else if (resp.status === 401) {
          errorMessage = "Unauthorized: Invalid or missing session";
          console.log(`[FETCHER] 401 error for ${url}, redirecting to /auth`);
          if (window.location.pathname !== "/auth" && !url.startsWith("/api/auth")) {
            window.location.href = "/auth";
          }
        } else if (resp.status === 409) {
          errorMessage = errorObj.error || "Resource already exists";
          console.log(`[FETCHER] 409 error for ${url}:`, errorMessage);
        } else if (resp.status === 404 && errorObj.error?.includes("User not found")) {
          errorMessage = "User not found in Sanity";
          console.log(`[FETCHER] 404 error for ${url}:`, errorMessage);
        } else {
          errorMessage = errorObj.error || errorObj.message || errorText;
          console.log(`[FETCHER] Other error for ${url}:`, errorMessage);
        }
      } catch {
        errorMessage = errorText || "Unknown error";
        console.log(`[FETCHER] Failed to parse error response for ${url}:`, errorText);
      }

      const error = new Error(errorMessage);
      (error as any).status = resp.status;
      console.log(`[FETCHER] Throwing error for ${url}:`, errorMessage);
      throw error;
    }

        // Handle 204 No Content responses
        if (resp.status === 204) {
          console.log(`[FETCHER] 204 No Content for ${url}, returning empty object`);
          return {};
        }

    console.log(`[FETCHER] Parsing response as JSON for ${url}`);
    const responseData = await resp.json();
    console.log(`[FETCHER] Response data for ${url}:`, responseData);
    return responseData;
  } catch (error) {
    console.error(`[FETCHER] Error for ${url}:`, error);
    throw error;
  }
};

interface User {
  name: string;
  email: string;
  interest: string;
  referralSource: string;
  userId?: string;
  userType?: string;
}

interface CharacterInput {
  id: UUID;
  name: string;
  username?: string;
  system?: string;
  bio?: string[];
  lore?: string[];
  messageExamples?: Array<{ conversation: Array<{ user: string; content: { text: string; action?: string } }> }>;
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
  };
  knowledge?: Array<any>;
  enabled?: boolean;
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
    backgroundImage?: string;
  };
  featuresSection: {
    heading: string;
    features: Array<{
      title: string;
      description: string;
      icon?: string;
    }>;
    ctaText: string;
  };
  benefitsSection: {
    heading: string;
    description: string;
    benefitsList: string[];
    image: string;
  };
  testimonialsSection: {
    heading: string;
    testimonials: Array<{
      quote: string;
      author: string;
      role: string;
    }>;
    trustSignal: string;
  };
  ctaSection: {
    heading: string;
    description: string;
    ctaText: string;
  };
  footerSection: {
    tagline: string;
    companyLinks: Array<{ label: string; url: string }>;
    productLinks: Array<{ label: string; url: string }>;
    legalLinks: Array<{ label: string; url: string }>;
  };
  subFooterSection: {
    ctaText: string;
    ctaUrl: string;
    copyright: string;
  };
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
}

export const apiClient = {
  sendMessage: (
    agentId: string,
    message: string,
    selectedFile?: File | null
  ) => {
    const formData = new FormData();
    formData.append("text", message);
    formData.append("user", "user");

    if (selectedFile) {
      formData.append("file", selectedFile);
    }
    return fetcher({
      url: `/api/${agentId}/message`,
      method: "POST",
      body: formData,
    });
  },
  getAgents: () => {
    console.log("[API_CLIENT] Calling getAgents");
    return fetcher({
      url: "/api/agents",
      method: "GET",
    });
  },
  getAgent: (agentId: string): Promise<{ id: UUID; character: Character }> =>
    fetcher({ url: `/api/agents/${agentId}` }),
  tts: (agentId: string, text: string) =>
    fetcher({
      url: `/api/${agentId}/tts`,
      method: "POST",
      body: {
        text,
      },
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
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
  createUser: async (user: User) => {
    try {
      const response = await fetcher({
        url: "/api/user",
        method: "POST",
        body: {
          _type: "User",
          name: user.name,
          email: user.email,
          interest: user.interest,
          referralSource: user.referralSource,
          userId: user.userId,
          createdAt: new Date().toISOString(),
          userType: user.userType || "email",
        },
      });
      return response.user; // Updated to match response format
    } catch (error: any) {
      console.error("Error in createUser:", error);
      throw new Error(error.message || "Failed to create or fetch user");
    }
  },
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

  deleteCharacter: (characterId: string) =>
    fetcher({
      url: `/api/characters/${characterId}`,
      method: "DELETE",
    }),
    createCheckoutSession: (data: { userId: string; items: { id: string; name: string; description: string; price: number; itemType: string }[] }) => {
      console.log("[API_CLIENT] Calling createCheckoutSession with data:", data);
      return fetcher({
        url: "/api/checkout-session",
        method: "POST",
        body: data,
      });
    },
    getKnowledge: (agentId: string) =>
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
    console.log("[API_CLIENT] Calling getUser");
    return fetcher({
      url: "/api/user",
      method: "GET",
    });
  },
  getItems: ({ itemType }: { itemType?: string } = {}) => {
    console.log("[API_CLIENT] Calling getItems", { itemType });
    return fetcher({
      url: `/api/items${itemType ? `?itemType=${itemType}` : ""}`,
      method: "GET",
    }) as Promise<{ items: Item[] }>;
  },
  getSubscriptionStatus: () => {
    console.log("[API_CLIENT] Calling getSubscriptionStatus");
    return fetcher({
      url: "/api/subscription-status",
      method: "GET",
    });
  },
  createPortalSession: () => {
    console.log("[API_CLIENT] Calling createPortalSession");
    return fetcher({
      url: "/api/create-portal-session",
      method: "POST",
    });
  },
  cancelSubscription: () => {
    console.log("[API_CLIENT] Calling cancelSubscription");
    return fetcher({
      url: "/api/cancel-subscription",
      method: "POST",
    });
  },
  getLandingPage: (): Promise<{ landingPage: LandingPage }> => {
    console.log("[API_CLIENT] Calling getLandingPage");
    return fetcher({
      url: "/api/landing-page",
      method: "GET",
    });
  },
};