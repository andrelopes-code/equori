import type { ScenarioGroup } from "@/features/assistant/preview/scenario";
import {
  readFallback,
  readHandled,
} from "@/features/assistant/preview/scenarios-read";
import {
  turnStates,
  writeFallback,
  writeHandled,
  writeOutcomes,
} from "@/features/assistant/preview/scenarios-write";
import { viewScenarios } from "@/features/assistant/preview/scenarios-views";

export const scenarioGroups: ScenarioGroup[] = [
  {
    title: "assistantPreview.views",
    description: "assistantPreview.views_description",
    scenarios: viewScenarios,
  },
  {
    title: "assistantPreview.read",
    description: "assistantPreview.read_description",
    scenarios: readHandled,
  },
  {
    title: "assistantPreview.read_fallback",
    description: "assistantPreview.read_fallback_description",
    scenarios: readFallback,
  },
  {
    title: "assistantPreview.write",
    description: "assistantPreview.write_description",
    scenarios: writeHandled,
  },
  {
    title: "assistantPreview.write_fallback",
    description: "assistantPreview.write_fallback_description",
    scenarios: writeFallback,
  },
  {
    title: "assistantPreview.outcomes",
    description: "assistantPreview.outcomes_description",
    scenarios: writeOutcomes,
  },
  {
    title: "assistantPreview.turns",
    description: "assistantPreview.turns_description",
    scenarios: turnStates,
  },
];
