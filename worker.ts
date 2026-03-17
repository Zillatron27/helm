interface Env {
  ASSETS: Fetcher;
  UMAMI_URL: string;
  UMAMI_WEBSITE_ID: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Serve the static asset first — never block on analytics
    const response = await env.ASSETS.fetch(request);

    // Only track navigation requests, not asset fetches
    const url = new URL(request.url);
    const accept = request.headers.get("Accept") || "";
    const isPageRequest =
      request.method === "GET" &&
      (accept.includes("text/html") || url.pathname === "/") &&
      !url.pathname.match(
        /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|json|map|wasm)$/
      );

    if (isPageRequest) {
      const ip = request.headers.get("CF-Connecting-IP") || "";
      const userAgent = request.headers.get("User-Agent") || "";

      ctx.waitUntil(
        fetch(`${env.UMAMI_URL}/api/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": userAgent,
          },
          body: JSON.stringify({
            type: "event",
            payload: {
              website: env.UMAMI_WEBSITE_ID,
              url: url.pathname + url.search,
              hostname: url.hostname,
              language:
                request.headers.get("Accept-Language")?.split(",")[0] || "",
              referrer: request.headers.get("Referer") || "",
              ip: ip,
              userAgent: userAgent,
            },
          }),
        }).catch(() => {
          // Silently swallow — analytics must never break the site
        })
      );
    }

    return response;
  },
} satisfies ExportedHandler<Env>;
