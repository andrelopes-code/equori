import { describe, expect, it } from "vitest";

import { readText } from "@/features/accounts/read-file";

const blob = (bytes: number[]) => new Blob([new Uint8Array(bytes)]);

describe("readText", () => {
  it("reads a file that is not UTF-8 as Windows-1252", async () => {
    const bytes = [
      0x44, 0x61, 0x74, 0x61, 0x3b, 0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69,
      0x63, 0x6f,
    ];
    expect(await readText(blob(bytes))).toBe("Data;Histórico");
  });

  it("keeps valid UTF-8 text", async () => {
    expect(await readText(new Blob(["Histórico"]))).toBe("Histórico");
  });

  it("reads a named encoding", async () => {
    expect(await readText(blob([0xe0]), "windows-1251")).toBe("а");
  });
});
