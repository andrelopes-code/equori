import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  readHidden,
  useHiddenBlocks,
} from "@/features/overview/use-hidden-blocks";

describe("readHidden", () => {
  it("keeps the known ids", () => {
    expect([...readHidden('["goals","x","cards"]')]).toEqual([
      "goals",
      "cards",
    ]);
  });
  it("reads nothing from a missing or broken value", () => {
    expect(readHidden(null).size).toBe(0);
    expect(readHidden("{").size).toBe(0);
    expect(readHidden('{"goals":true}').size).toBe(0);
  });
});

describe("useHiddenBlocks", () => {
  it("shows every block when storage throws", () => {
    const get = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const set = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    const { result } = renderHook(() => useHiddenBlocks());
    expect(result.current.hidden.size).toBe(0);
    act(() => {
      result.current.hide("goals");
    });
    expect([...result.current.hidden]).toEqual(["goals"]);
    get.mockRestore();
    set.mockRestore();
  });
});
