import type { MessageKey } from "@/i18n/catalog.en";

export const settingsGroups = [
  { id: "personal", title: "settings.group.personal" },
  { id: "books", title: "settings.group.books" },
  { id: "connections", title: "settings.group.connections" },
  { id: "system", title: "settings.group.system" },
] as const satisfies readonly { id: string; title: MessageKey }[];

// The panes of the settings page, in reading order. Each id is the value of the page's section
// search key and of its entry in the page's navigation.
export const settingsTopics = [
  {
    id: "account",
    group: "personal",
    title: "settings.account.title",
    summary: "settings.summary.account",
  },
  {
    id: "security",
    group: "personal",
    title: "settings.security.title",
    summary: "settings.summary.security",
  },
  {
    id: "appearance",
    group: "personal",
    title: "settings.appearance.title",
    summary: "settings.summary.appearance",
  },
  {
    id: "language",
    group: "personal",
    title: "settings.language.title",
    summary: "settings.summary.language",
  },
  {
    id: "privacy",
    group: "personal",
    title: "settings.privacy.title",
    summary: "settings.summary.privacy",
  },
  {
    id: "finances",
    group: "books",
    title: "settings.ledger.title",
    summary: "settings.summary.finances",
  },
  {
    id: "calendars",
    group: "books",
    title: "calendar.title",
    summary: "settings.summary.calendars",
  },
  {
    id: "members",
    group: "books",
    title: "settings.members.title",
    summary: "settings.summary.members",
  },
  {
    id: "integrations",
    group: "connections",
    title: "settings.integrations.title",
    summary: "settings.summary.integrations",
  },
  {
    id: "market_data",
    group: "connections",
    title: "settings.market_data.title",
    summary: "settings.summary.market_data",
  },
  {
    id: "assistant",
    group: "connections",
    title: "settings.assistant.title",
    summary: "settings.summary.assistant",
  },
  {
    id: "external_access",
    group: "connections",
    title: "settings.external_access.title",
    summary: "settings.summary.external_access",
  },
  {
    id: "data",
    group: "system",
    title: "settings.data.title",
    summary: "settings.summary.data",
  },
  {
    id: "backup",
    group: "system",
    title: "settings.backup.title",
    summary: "settings.summary.backup",
    admin: true,
  },
  {
    id: "about",
    group: "system",
    title: "settings.about.title",
    summary: "settings.summary.about",
    admin: true,
  },
] as const satisfies readonly {
  id: string;
  group: (typeof settingsGroups)[number]["id"];
  title: MessageKey;
  summary: MessageKey;
  admin?: true;
}[];

export type SettingsTopic = (typeof settingsTopics)[number]["id"];

export function isSettingsTopic(value: unknown): value is SettingsTopic {
  return settingsTopics.some((topic) => topic.id === value);
}
