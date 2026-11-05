import { afterEach, describe, expect, it, vi } from "vitest";

import { copyText } from "@/ui/copy-text";

describe("copyText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("writes through the Clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyText("ABCD EFGH", document.body);

    expect(writeText).toHaveBeenCalledWith("ABCD EFGH");
  });

  it("selects a text area and runs the copy command outside a secure context", async () => {
    let copied = "";
    const host = document.createElement("div");
    document.body.append(host);
    const execCommand = vi.fn((command: string) => {
      copied = host.querySelector("textarea")?.value ?? "";
      return command === "copy";
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    });
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});

    await copyText("AAAA-BBBB\nCCCC-DDDD", host);

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("AAAA-BBBB\nCCCC-DDDD");
    expect(host.querySelector("textarea")).toBeNull();
  });

  it("rejects when the browser refuses the copy command", async () => {
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: () => false,
    });
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});

    await expect(copyText("x", document.body)).rejects.toThrow("copy refused");
  });
});
