// /client/src/lib/clearCookies.tsx
export const clearCookies = (forceAll: boolean = false) => {
  console.log("[CLEAR_COOKIES] Cookies before clearing:", document.cookie);

  const cookies = document.cookie.split(";");
  const domains = [
    "agentvooc.com",
    ".agentvooc.com",
    window.location.hostname,
    `.${window.location.hostname}`,
    "", // Root domain
  ];
  const paths = ["/", "/api/auth", "/api/auth/session/refresh"];
  const stCookies = [
    "sAccessToken",
    "sRefreshToken",
    "sFrontToken",
    "sAntiCsrf",
    "st-last-access-token-update",
    "st-access-token",
    "st-refresh-token",
  ];

  if (forceAll) {
    // Clear all cookies as a fallback
    for (const cookie of cookies) {
      const [name] = cookie.split("=").map((c) => c.trim());
      for (const domain of domains) {
        for (const path of paths) {
          const cookieString = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};${domain ? `domain=${domain};` : ""}Secure;SameSite=Strict`;
          document.cookie = cookieString;
          console.log(`[CLEAR_COOKIES] Cleared cookie: ${cookieString}`);
        }
      }
    }
  } else {
    // Clear only SuperTokens cookies
    for (const cookie of cookies) {
      const [name] = cookie.split("=").map((c) => c.trim());
      if (stCookies.includes(name)) {
        for (const domain of domains) {
          for (const path of paths) {
            const cookieString = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};${domain ? `domain=${domain};` : ""}Secure;SameSite=Strict`;
            document.cookie = cookieString;
            console.log(`[CLEAR_COOKIES] Cleared cookie: ${cookieString}`);
          }
        }
      }
    }
  }

  console.log("[CLEAR_COOKIES] Cookies after clearing:", document.cookie);
};