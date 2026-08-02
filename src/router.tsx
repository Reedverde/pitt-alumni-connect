import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // A first ever visit lands on a cold Worker. One transient failure must not
  // become an error screen a human has to act on, so every read retries with
  // backoff before it is allowed to throw.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 3,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  // Without this the server's query cache is thrown away, so every first visit
  // fetches the whole board a second time from the browser. That second fetch,
  // against a cold Worker, is what produced the "board didn't load" screen.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
