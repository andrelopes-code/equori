import { describe, expect, it } from "vitest";

import { filesLine } from "@/features/assistant/panel/files-line";

describe("filesLine", () => {
  it.each([
    [[], "Gemini", true, null],
    [["ofx"], undefined, true, null],
    [["ofx", "csv"], "Gemini", false, "assistant.files.line.summary"],
    [["pdf"], "Gemini", true, "assistant.files.line.whole"],
    [["ofx", "image"], "Gemini", true, "assistant.files.line.mixed"],
    [["ofx", "pdf"], "Gemini", false, "assistant.files.line.unread"],
    [["text"], "Gemini", false, "assistant.files.line.unread"],
  ] as const)(
    "kinds %j through %s, reads %s: %s",
    (kinds, provider, reads, key) => {
      const line = filesLine([...kinds], provider, reads);

      expect(line?.key ?? null).toBe(key);
      if (line !== null) expect(line.provider).toBe("Gemini");
    },
  );
});
