import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuestionList } from "@/features/portfolio/contribution-plan/editor/question-list";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { piotroskiFacts } from "@/features/portfolio/contribution-plan/model/fact-answers";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

function mount(questions: string[], facts: string[]) {
  const addFactQuestions = vi.fn();
  const editor = { addFactQuestions } as unknown as PlanEditor;

  renderWithProviders(
    <QuestionList
      index={0}
      questions={questions}
      facts={facts}
      editor={editor}
    />,
    { fetch: fakeApi({}) },
  );

  return { addFactQuestions, user: userEvent.setup() };
}

const useMethod = () =>
  screen.queryByRole("button", {
    name: catalogEn["contributionPlan.method.piotroski.use"],
  });

describe("QuestionList method row", () => {
  it("adds the nine signals in one action", async () => {
    const { addFactQuestions, user } = mount([], []);

    const button = useMethod();
    if (button === null) throw new Error("the method row is absent");
    await user.click(button);

    expect(addFactQuestions).toHaveBeenCalledTimes(1);
    const [index, entries] = addFactQuestions.mock.calls[0] as [
      number,
      { fact: string; text: string }[],
    ];
    expect(index).toBe(0);
    expect(entries.map((e) => e.fact)).toEqual(piotroskiFacts);
    expect(entries[0]?.text).toBe("Positive return on assets");
  });

  it("is absent once a fact is named", () => {
    mount(["x"], ["piotroski_p1"]);

    expect(useMethod()).toBeNull();
  });

  it("is absent with two questions without facts", () => {
    mount(["a", "b"], ["", ""]);

    expect(useMethod()).toBeNull();
  });
});

describe("QuestionList fact question", () => {
  it("draws the catalog text read-only with the note", () => {
    mount(["stored"], ["piotroski_p1"]);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Positive return on assets")).toBeVisible();
    expect(
      screen.getByText(catalogEn["contributionPlan.facts.note"]),
    ).toBeVisible();
  });

  it("draws the stored text for a key the catalog lacks", () => {
    mount(["Stored text"], ["piotroski_p99"]);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Stored text")).toBeVisible();
  });

  it("keeps the text box of a question without a fact", () => {
    mount(["own", "fact"], ["", "piotroski_p1"]);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});
