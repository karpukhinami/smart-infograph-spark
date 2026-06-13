import { Link, Outlet, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { useSettingsStore } from "@/store/useSettingsStore";
import { CostMeter } from "@/components/workspace/CostMeter";

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
      { property: "og:title", content: "AI Infographic Generator" },
      { name: "twitter:title", content: "AI Infographic Generator" },
      { property: "og:description", content: "Multi-stage debugging-oriented infographic generator." },
      { name: "twitter:description", content: "Multi-stage debugging-oriented infographic generator." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cf25be62-80f9-46e7-8a76-fd41cd76895f/id-preview-180e412d--98cd2499-b42c-4a92-bbc7-edc10ffcd6a6.lovable.app-1780784354466.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/cf25be62-80f9-46e7-8a76-fd41cd76895f/id-preview-180e412d--98cd2499-b42c-4a92-bbc7-edc10ffcd6a6.lovable.app-1780784354466.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
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
  const uiMode = useSettingsStore((s) => s.uiMode);
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-border bg-sidebar/60 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-3">
              <UiModeSwitch />
              {uiMode === "debug" && <ModeSwitch />}
              <Link to="/" className="text-base font-semibold tracking-tight">
                AI Infographic Generator
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {uiMode === "debug" && (
                <nav className="flex gap-4 text-sm text-muted-foreground">
                  <Link to="/" activeProps={{ className: "text-foreground font-medium" }}>Рабочее место</Link>
                  <Link to="/styles" activeProps={{ className: "text-foreground font-medium" }}>Стили</Link>
                  <Link to="/design-profiles" activeProps={{ className: "text-foreground font-medium" }}>Профили дизайна</Link>
                  <Link to="/prompts" activeProps={{ className: "text-foreground font-medium" }}>Промпты</Link>
                </nav>
              )}
              <CostMeter />
            </div>
          </div>
        </header>
        <main className="flex-1"><Outlet /></main>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

function UiModeSwitch() {
  const uiMode = useSettingsStore((s) => s.uiMode);
  const setUiMode = useSettingsStore((s) => s.setUiMode);
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
      {([
        ["debug", "Отладка"],
        ["user", "Для пользователя"],
      ] as const).map(([m, label]) => (
        <button
          key={m}
          type="button"
          onClick={() => setUiMode(m)}
          className={`px-2.5 py-1 rounded-sm transition-colors ${
            uiMode === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={m === "debug" ? "Отладочный режим: все настройки видны" : "Пользовательский режим: служебные элементы скрыты"}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ModeSwitch() {
  const mode = useSettingsStore((s) => s.mode);
  const setMode = useSettingsStore((s) => s.setMode);
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
      {(["strict", "free"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`px-2.5 py-1 rounded-sm transition-colors ${
            mode === m
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={m === "strict" ? "Строгий режим: свои промпты и стили" : "Вольный режим: свои промпты и стили"}
        >
          {m === "strict" ? "Строгий" : "Вольный"}
        </button>
      ))}
    </div>
  );
}
