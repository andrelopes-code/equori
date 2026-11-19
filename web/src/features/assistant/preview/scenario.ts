import type { components } from "@/api/schema.gen";
import type { MessageKey } from "@/i18n/catalog.en";

type Message = components["schemas"]["AssistantMessage"];

// One question of the preview and the answer the assistant gives to it. handled: the answer has a
// form of its own; false when it falls back to text or a list of fields.
export interface Scenario {
  id: string;
  form: string;
  note: string;
  handled: boolean;
  question: string;
  answer: string;
  proposals?: Message["proposals"];
  outcome?: Message["outcome"];
  steps?: string[];
}

export interface ScenarioGroup {
  title: MessageKey;
  description: MessageKey;
  scenarios: Scenario[];
}

export function scenarioMessage(scenario: Scenario): Message {
  return {
    id: scenario.id,
    role: "assistant",
    content: scenario.answer,
    outcome: scenario.outcome ?? "answered",
    created_at: "2026-11-19T10:00:00Z",
    files: [],
    proposals: scenario.proposals ?? [],
  };
}
