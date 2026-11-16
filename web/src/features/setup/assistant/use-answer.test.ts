import { describe, expect, it } from "vitest";

import type { ModelUse, UsageRow } from "@/features/setup/api";
import {
  answering,
  targetState,
  useNote,
} from "@/features/setup/assistant/use-answer";

describe("use answer (A3, A6)", () => {
  it("answers with the first target that offers the needs and is not resting", () => {
    const use = chat([claude, flash, lite]);

    expect(answering(use, [], now)?.model).toBe("flash");
    expect(
      answering(use, [row("flash", { cooling_until: later })], now)?.model,
    ).toBe("lite");
    expect(
      answering(
        use,
        [row("flash", { today_requests: 5, requests_per_day: 5 })],
        now,
      )?.model,
    ).toBe("lite");
    expect(
      answering(use, [row("flash", { cooling_until: earlier })], now)?.model,
    ).toBe("flash");
  });

  it("answers with none when every target lacks a need or rests", () => {
    expect(answering(chat([claude]), [], now)).toBeUndefined();
    expect(answering(chat([]), [], now)).toBeUndefined();
  });

  it("states each target of a chain", () => {
    const use = chat([claude, flash, lite, lite31]);
    const rows = [row("lite", { cooling_until: later })];

    expect(
      use.targets.map((target) => targetState(use, target, rows, now)),
    ).toEqual(["lacking", "answering", "resting", "waiting"]);
  });

  it("notes the first condition of a use", () => {
    expect(useNote(chat([claude, flash]), [], now)).toEqual({
      kind: "lacks",
      model: "claude",
      missing: ["tools"],
    });
    expect(
      useNote(
        chat([flash, lite]),
        [row("lite", { cooling_until: later })],
        now,
      ),
    ).toEqual({
      kind: "paused",
      model: "lite",
      until: later,
    });
    expect(
      useNote(
        chat([flash, lite]),
        [row("lite", { today_tokens: 9, tokens_per_day: 9 })],
        now,
      ),
    ).toEqual({ kind: "reached", model: "lite" });
    expect(useNote(chat([flash]), [], now)).toEqual({ kind: "custom" });
    expect(useNote({ ...chat([flash]), default: true }, [], now)).toEqual({
      kind: "default",
    });
  });
});

const now = new Date("2026-11-16T12:00:00Z");
const later = "2026-11-16T23:10:00Z";
const earlier = "2026-11-16T09:00:00Z";

type Target = ModelUse["targets"][number];

function target(model: string, capabilities: Target["capabilities"]): Target {
  return {
    provider_id: "p",
    provider_name: "P",
    preset: "gemini",
    notice: "trains",
    model,
    capabilities,
  };
}

const claude = target("claude", ["structured_output"]);
const flash = target("flash", ["tools", "structured_output"]);
const lite = target("lite", ["tools"]);
const lite31 = target("lite31", ["tools"]);

function chat(targets: Target[]): ModelUse {
  return {
    id: "assistant.chat",
    needs: ["tools"],
    sends_financial_data: true,
    default: false,
    targets,
  };
}

function row(model: string, over: Partial<UsageRow>): UsageRow {
  return {
    provider_id: "p",
    provider_name: "P",
    preset: "gemini",
    instance: false,
    model,
    today_requests: 0,
    today_errors: 0,
    today_tokens: 0,
    period_requests: 0,
    period_tokens: 0,
    period_days: 30,
    ...over,
  };
}
