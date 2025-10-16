// In-memory rate limiter; enable if needed for production
// const limits = new Map<string, { count: number; reset: number }>();  

// export function rateLimitCheck(key: string, limit = 5, window = 60000) {
//   const now = Date.now();
//   const entry = limits.get(key) || { count: 0, reset: now + window };
//   if (now > entry.reset) {
//     entry.count = 0;
//     entry.reset = now + window;
//   }
//   if (entry.count >= limit) throw new Error("Rate limit exceeded");
//   entry.count++;
//   limits.set(key, entry);
// }