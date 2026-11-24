import { beforeEach, describe, expect, it, vi } from "vitest";

import { launchPluggy } from "@/features/accounts/connect/pluggy-launcher";

interface Options {
  connectToken: string;
  connectorIds: number[];
  language: string;
  onSuccess: (data: { item: { id: string } }) => void;
  onClose: () => void;
}

const sdk = vi.hoisted(() => ({
  options: [] as unknown[],
  init: vi.fn<() => Promise<void>>(),
  destroy: vi.fn<() => Promise<void>>(),
}));

vi.mock("pluggy-connect-sdk", () => ({
  PluggyConnect: class {
    init = sdk.init;
    destroy = sdk.destroy;

    constructor(options: unknown) {
      sdk.options.push(options);
    }
  },
}));

describe("launchPluggy", () => {
  beforeEach(() => {
    // jsdom has no constructed style sheets.
    document.adoptedStyleSheets = [];
    sdk.options.length = 0;
    sdk.init.mockReset().mockResolvedValue();
    sdk.destroy.mockReset().mockResolvedValue();
  });

  it("answers the id of the item and closes the dialog", async () => {
    const answer = launchPluggy("token-1", "pt");
    const options = await opened();

    options.onSuccess({ item: { id: "item-1" } });

    expect(await answer).toBe("item-1");
    expect(sdk.destroy).toHaveBeenCalledTimes(1);
    expect(options).toMatchObject({
      connectToken: "token-1",
      connectorIds: [200],
      language: "pt",
    });
  });

  it("answers null when the reader closes the dialog", async () => {
    const answer = launchPluggy("token-1", "pt");
    const options = await opened();

    options.onClose();

    expect(await answer).toBeNull();
  });

  it("rejects when the dialog does not open", async () => {
    sdk.init.mockRejectedValue(new Error("blocked"));

    await expect(launchPluggy("token-1", "pt")).rejects.toThrow("blocked");
  });
});

async function opened(): Promise<Options> {
  await vi.waitFor(() => {
    expect(sdk.options).toHaveLength(1);
  });

  return sdk.options[0] as Options;
}
