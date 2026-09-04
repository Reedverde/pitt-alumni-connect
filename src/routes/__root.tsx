import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "../components/ui/sonner";
import { RsvpDock } from "../components/rsvp/RsvpDock";

import { reportLovableError } from "../lib/lovable-error-reporting";
import { captureRsvpSource } from "../lib/rsvp-src";
import { SAFE_STORAGE_SNIPPET } from "../lib/safe-storage";
import { OG_IMAGE, SITE_ORIGIN } from "../lib/site-url";

function NotFoundComponent() {
  return (
    <div
      style={{ background: "var(--field-white)" }}
      className="flex min-h-screen flex-col items-center justify-center px-5"
    >
      {/* pb-40 keeps the actions clear of the floating RSVP bar, which on a
          phone is a full width strip along the bottom edge. */}
      <main id="main" className="w-full max-w-[560px] pb-40 text-center">
        <p
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 13,
            letterSpacing: "0.08em",
            color: "var(--sterling)",
          }}
        >
          404
        </p>
        <h1
          className="display-30 mt-3"
          style={{ color: "var(--sabah-black)" }}
        >
          That page is not here.
        </h1>
        <p className="mt-4" style={{ fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 }}>
          The link may be old, or the page may have moved. The board and the schedule are both
          one tap away.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/"
            className="label-caps"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 20px",
              borderRadius: 7,
              background: "var(--pitt-royal)",
              color: "var(--pure-white)",
              textDecoration: "none",
            }}
          >
            Find your name
          </Link>
          <Link
            to="/schedule"
            className="label-caps"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              padding: "0 12px",
              color: "var(--pitt-royal)",
              textDecoration: "none",
            }}
          >
            This year&rsquo;s schedule
          </Link>
        </div>
      </main>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Pitt Club Ultimate Alumni Weekend" },
      { name: "description", content: "October 2 to 4, 2026 in Pittsburgh. Find your name and tell us if you are coming." },
      { name: "author", content: "Pitt Ultimate Alumni" },
      { property: "og:title", content: "Pitt Club Ultimate Alumni Weekend" },
      { property: "og:description", content: "October 2 to 4, 2026 in Pittsburgh. Find your name and tell us if you are coming." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Pitt Club Ultimate Alumni Weekend, October 2 to 4, 2026" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@PittUltimate" },
      { name: "twitter:title", content: "Pitt Club Ultimate Alumni Weekend" },
      { name: "twitter:description", content: "October 2 to 4, 2026 in Pittsburgh. Find your name and tell us if you are coming." },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Must run before any module script. In iOS in-app webviews, Private
            Browsing and Lockdown Mode, reading window.localStorage throws and
            kills hydration, leaving a page whose buttons do nothing. */}
        <script dangerouslySetInnerHTML={{ __html: SAFE_STORAGE_SNIPPET }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Any route, first touch only. Deep links carry ?src= too.
  useEffect(() => {
    captureRsvpSource(window.location.search);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* One card, every page: the answer is always within reach. */}
      <RsvpDock />
    </QueryClientProvider>
  );
}

