import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnswerView } from "@/features/assistant/view/answer-view";
import type { AssistantView } from "@/features/assistant/view/view-types";
import { fakeApi } from "@/testing/fake-api";
import { renderWithRouter } from "@/testing/render-app";

const view: AssistantView = {
  id: "s1",
  form: "sources",
  payload: {
    title: { key: "assistantView.sources.title" },
    window: {},
    verdict: {
      key: "assistantView.sources.verdict",
      params: { count: { count: 2 } },
    },
    next: [],
    rows: {
      head: ["assistantView.sources.source", "assistantView.sources.address"],
      rows: [
        [{ text: "Banco Central" }, { text: "https://bcb.example/selic" }],
        [{ text: "x" }, { text: "javascript:alert(1)" }],
      ],
    },
    data: {
      sources: [
        { url: "https://bcb.example/selic", title: "Banco Central" },
        { url: "javascript:alert(1)", title: "x" },
      ],
    },
  },
};

describe("SourcesBody", () => {
  // Web search design, S7: a source is a link to a new tab; an address that is not http or
  // https draws no link.
  it("links each web source in a new tab and names its host", () => {
    renderWithRouter(<AnswerView view={view} />, {
      path: "/",
      fetch: fakeApi({}),
    });

    const link = screen.getByRole("link", { name: /Banco Central/ });

    expect(link).toHaveAttribute("href", "https://bcb.example/selic");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("bcb.example")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByLabelText("Sources on the web")).toHaveTextContent(
      "Pages cited: 2.",
    );
  });
});
