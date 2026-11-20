import type { components } from "@/api/schema.gen";

type Chat = components["schemas"]["AssistantChat"];
export type ChatTarget = Chat["targets"][number];
export type TargetChoice = components["schemas"]["AssistantTargetChoice"];

// The choice is a browser setting (model choice design, MC5).
const storageKey = "equori.assistant.target";
const listeners = new Set<() => void>();

export function readStoredChoice(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function writeStoredChoice(choice: TargetChoice | null) {
  try {
    if (choice === null) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(choice));
  } catch {
    // A browser that refuses storage keeps the choice for no later turn.
  }

  for (const listener of listeners) listener();
}

export function subscribeStoredChoice(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

// The stored choice when the chat still offers it; anything else reads as no choice (MC5).
export function chosenTarget(
  chat: Chat | undefined,
  stored: string | null,
): ChatTarget | undefined {
  if (chat === undefined || stored === null) return undefined;

  const choice = parseChoice(stored);
  if (choice === undefined) return undefined;

  return chat.targets.find(
    (t) => t.provider_id === choice.provider_id && t.model === choice.model,
  );
}

// The chat as the chosen target presents it: its provider, model, notice and file reading (MC7).
export function chatWithTarget<C extends Chat | undefined>(
  chat: C,
  target: ChatTarget | undefined,
): C {
  if (chat === undefined || target === undefined) return chat;

  return {
    ...chat,
    provider_name: target.provider_name,
    model: target.model,
    notice: target.notice,
    reads_files: target.reads_files,
  };
}

export function targetKey(target: TargetChoice): string {
  return JSON.stringify([target.provider_id, target.model]);
}

function parseChoice(stored: string): TargetChoice | undefined {
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return undefined;

    const { provider_id, model } = value as Record<string, unknown>;
    if (typeof provider_id !== "string" || typeof model !== "string")
      return undefined;

    return { provider_id, model };
  } catch {
    return undefined;
  }
}
