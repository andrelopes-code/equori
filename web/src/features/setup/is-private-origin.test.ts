import { describe, expect, it } from "vitest";

import { isPrivateOrigin } from "@/features/setup/is-private-origin";

describe("isPrivateOrigin", () => {
  it.each([
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://192.168.0.10",
    "http://10.1.2.3",
    "http://172.20.0.1",
    "http://169.254.1.1",
    "http://[::1]:8080",
    "http://nas.local",
  ])("%s is private", (origin) => {
    expect(isPrivateOrigin(origin)).toBe(true);
  });

  it.each([
    "https://finance.example.com",
    "http://172.32.0.1",
    "http://8.8.8.8",
  ])("%s is public", (origin) => {
    expect(isPrivateOrigin(origin)).toBe(false);
  });
});
