import type { AssistantFile } from "@/features/assistant/api";
import type { MessageKey } from "@/i18n/catalog.en";

// FU4: the line under the chips that states what of the files leaves the instance.
export interface FilesLine {
  key: MessageKey;
  provider: string;
}

const readable = new Set<AssistantFile["kind"]>(["pdf", "image", "text"]);

export function filesLine(
  kinds: AssistantFile["kind"][],
  provider: string | undefined,
  readsFiles: boolean,
): FilesLine | null {
  if (kinds.length === 0 || provider === undefined) return null;

  const whole = kinds.some((k) => readable.has(k));
  const summary = kinds.some((k) => !readable.has(k));

  if (whole && !readsFiles) {
    return { key: "assistant.files.line.unread", provider };
  }

  if (whole && summary) return { key: "assistant.files.line.mixed", provider };

  if (whole) return { key: "assistant.files.line.whole", provider };

  return { key: "assistant.files.line.summary", provider };
}
