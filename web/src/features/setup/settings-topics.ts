import type { MessageKey } from "@/i18n/catalog.en";

// The sections of the settings page, in reading order. Each id is a section's anchor and the
// value of its entry in the page's contents.
export const settingsTopics = [
  { id: "account", title: "settings.account.title" },
  { id: "appearance", title: "settings.appearance.title" },
  { id: "language", title: "settings.language.title" },
  { id: "privacy", title: "settings.privacy.title" },
  { id: "finances", title: "settings.ledger.title" },
  { id: "assistant", title: "settings.assistant.title" },
] as const satisfies readonly { id: string; title: MessageKey }[];

export type SettingsTopic = (typeof settingsTopics)[number]["id"];
