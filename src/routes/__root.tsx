import { Link, Outlet, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Страница не найдена.</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">На главную</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >Повторить</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Infographic Generator" },
      { name: "description", content: "Multi-stage debugging-oriented infographic generator." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border bg-sidebar/60 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
            <Link to="/" className="text-base font-semibold tracking-tight">
              AI Infographic Generator
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link to="/" activeProps={{ className: "text-foreground font-medium" }}>Рабочее место</Link>
              <Link to="/styles" activeProps={{ className: "text-foreground font-medium" }}>Стили</Link>
              <Link to="/design-profiles" activeProps={{ className: "text-foreground font-medium" }}>Профили дизайна</Link>
              <Link to="/prompts" activeProps={{ className: "text-foreground font-medium" }}>Промпты</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1"><Outlet /></main>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
