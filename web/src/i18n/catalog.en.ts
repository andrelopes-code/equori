export const catalogEn = {
  "nav.home": "Home",
  "common.selected": "{count} selected",
} as const;

export type Catalog = { [K in keyof typeof catalogEn]: string };
export type MessageKey = keyof Catalog;
