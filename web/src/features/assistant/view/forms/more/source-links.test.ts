import { describe, expect, it } from "vitest";

import { sourceLinks } from "@/features/assistant/view/forms/more/source-links";

describe("sourceLinks", () => {
  // Web search design, S7: a source opens only as an http or https address.
  it("keeps the http and https sources with their host", () => {
    const got = sourceLinks({
      sources: [
        { url: "https://www.bcb.example/selic?x=1", title: "Banco Central" },
        { url: "javascript:alert(1)", title: "x" },
        { url: "http://news.example/juros", title: "news.example" },
        { url: "not an address", title: "y" },
      ],
    });

    expect(got).toEqual([
      {
        url: "https://www.bcb.example/selic?x=1",
        title: "Banco Central",
        host: "www.bcb.example",
      },
      {
        url: "http://news.example/juros",
        title: "news.example",
        host: "news.example",
      },
    ]);
  });

  it("returns no link for data without sources", () => {
    expect(sourceLinks({})).toEqual([]);
    expect(sourceLinks(undefined)).toEqual([]);
  });
});
