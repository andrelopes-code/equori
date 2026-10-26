import { describe, expect, it, vi } from "vitest";

import { registerServiceWorker } from "@/app/service-worker";

describe("registerServiceWorker", () => {
  it("registers /sw.js in a secure production page", () => {
    const register = vi.fn(() => Promise.resolve({}));
    registerServiceWorker({
      prod: true,
      secure: true,
      container: { register },
    });
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it.each([
    { prod: false, secure: true },
    { prod: true, secure: false },
  ])("does nothing when prod=$prod and secure=$secure", (env) => {
    const register = vi.fn(() => Promise.resolve({}));
    registerServiceWorker({ ...env, container: { register } });
    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing without service worker support", () => {
    expect(() => {
      registerServiceWorker({ prod: true, secure: true, container: undefined });
    }).not.toThrow();
  });
});
