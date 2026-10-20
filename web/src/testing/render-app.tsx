import { act, render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryHistory } from "@tanstack/react-router";

import { AppProviders } from "@/app/providers";
import { AppRouterProvider, newRouter } from "@/app/router";
import type { AppRouter } from "@/app/router";
import { setViewport } from "@/testing/viewport";

export async function renderApp(
  path: string,
  opts: { width?: number; today?: string; fetch: typeof fetch },
): Promise<RenderResult & { router: AppRouter }> {
  setViewport(opts.width ?? 1280);
  const router = newRouter(createMemoryHistory({ initialEntries: [path] }));
  const result = render(
    <AppProviders
      fetchImpl={opts.fetch}
      today={opts.today ?? "2026-10-17"}
      retryDelay={0}
    >
      <AppRouterProvider router={router} />
    </AppProviders>,
    // The application renders under StrictMode (main.tsx); the tests render it the same way.
    { reactStrictMode: true },
  );
  await act(async () => {
    await router.load();
  });
  return { ...result, router };
}

// Renders one component under the application's providers, without the router.
export function renderWithProviders(
  ui: ReactNode,
  opts: { today?: string; fetch: typeof fetch },
): RenderResult {
  return render(
    <AppProviders
      fetchImpl={opts.fetch}
      today={opts.today ?? "2026-10-17"}
      retryDelay={0}
    >
      {ui}
    </AppProviders>,
    { reactStrictMode: true },
  );
}
