import { RouterContextProvider } from "@tanstack/react-router";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCalculatorSearch } from "@/features/calculators/model/calculator-search";
import { calculatorApiRoutes, ipcaFixture } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const keys = ["a", "b", "keep"] as const;

type Hook = ReturnType<typeof useCalculatorSearch<(typeof keys)[number]>>;

async function mountHook(search: string) {
  const { router } = await renderApp(`/calculators/correction?${search}`, {
    fetch: fakeApi(calculatorApiRoutes([ipcaFixture()])),
  });
  const hook: { current: Hook | null } = { current: null };

  function Probe() {
    hook.current = useCalculatorSearch(keys);
    return null;
  }

  render(
    <RouterContextProvider router={router}>
      <Probe />
    </RouterContextProvider>,
  );

  return { router, hook };
}

describe("useCalculatorSearch", () => {
  it("removes the keys set to undefined or an empty text and keeps the others", async () => {
    const { router, hook } = await mountHook("a=1&b=2&keep=3");

    act(() => {
      hook.current?.[1]({ a: undefined, b: "" });
    });

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ keep: "3" });
    });
    expect(hook.current?.[0]).toEqual({ keep: "3" });
  });

  it("reads a quoted value and an unquoted value alike", async () => {
    const quoted = await mountHook("a=%2212%22&b=text");
    const unquoted = await mountHook("a=12&b=text");

    expect(quoted.hook.current?.[0]).toEqual({ a: "12", b: "text" });
    expect(unquoted.hook.current?.[0]).toEqual({ a: "12", b: "text" });
  });
});
