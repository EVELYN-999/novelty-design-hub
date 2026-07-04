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
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-lg text-center">
        <div className="marginalia">Notice · Page not found</div>
        <h1 className="mt-6 font-display text-8xl leading-none tracking-tight">404</h1>
        <div className="mx-auto mt-6 h-px w-24 bg-ink" />
        <h2 className="mt-6 font-display text-2xl italic">This edition is missing a page.</h2>
        <p className="mt-3 text-sm text-ink-soft">
          The requested article was withdrawn, misfiled, or never printed.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="smallcaps inline-flex items-center justify-center border-2 border-ink px-6 py-3 text-xs text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            Return to Front Page
          </Link>
        </div>
      </div>
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
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-lg text-center">
        <div className="marginalia">Errata · Printing halted</div>
        <h1 className="mt-6 font-display text-3xl italic">A press has jammed.</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Please pull the lever again, or return to the front page.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="smallcaps border-2 border-ink px-6 py-3 text-xs text-ink hover:bg-ink hover:text-paper transition-colors"
          >
            Reset the press
          </button>
          <a
            href="/"
            className="smallcaps border-2 border-ink/30 px-6 py-3 text-xs text-ink hover:border-ink transition-colors"
          >
            Front page
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
      { title: "The Ballot Gazette — Verifiable, Private Elections" },
      { name: "description", content: "A tamper-evident election system for The Herald Society. No one can determine how a person voted; anyone can verify the results." },
      { name: "author", content: "The Herald Society" },
      { property: "og:title", content: "The Ballot Gazette — Verifiable, Private Elections" },
      { property: "og:description", content: "Cast, receipt, and independently recount. A letterpress-styled election of record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
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
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
