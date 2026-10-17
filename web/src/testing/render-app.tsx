import { act, render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
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
  );
  await act(async () => {
    await router.load();
  });
  return { ...result, router };
}
