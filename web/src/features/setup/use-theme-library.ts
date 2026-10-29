import { useT } from "@/i18n/i18n-provider";
import { useSavedThemes } from "@/theme/theme-file";
import {
  applyThemeValues,
  curatedThemeIDs,
  matchTheme,
  useThemeValues,
} from "@/theme/themes";
import type { SavedTheme, ThemeValues } from "@/theme/themes";

const MAX_SAVED = 50;

export interface ThemeLibrary {
  values: ThemeValues;
  saved: readonly SavedTheme[];
  active: string | null;
  activeSaved: SavedTheme | null;
  // The name of the active theme as the reader reads it; null while the values are custom.
  activeName: string | null;
  full: boolean;
  choose: (values: ThemeValues) => void;
  save: (name: string, values: ThemeValues) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

// The curated and saved themes, the one the current values match, and the writes on the saved list.
export function useThemeLibrary(): ThemeLibrary {
  const t = useT();
  const values = useThemeValues();
  const [saved, setSaved] = useSavedThemes();

  const active = matchTheme(values, saved);
  const activeSaved = saved.find((theme) => theme.id === active) ?? null;
  const curated = curatedThemeIDs.find((id) => id === active);
  const activeName =
    activeSaved?.name ?? (curated === undefined ? null : t(`theme.${curated}`));

  return {
    values,
    saved,
    active,
    activeSaved,
    activeName,
    full: saved.length >= MAX_SAVED,
    choose: applyThemeValues,
    save: (name, next) => {
      setSaved([...saved, { id: crypto.randomUUID(), name, values: next }]);
      applyThemeValues(next);
    },
    rename: (id, name) => {
      setSaved(
        saved.map((theme) => (theme.id === id ? { ...theme, name } : theme)),
      );
    },
    remove: (id) => {
      setSaved(saved.filter((theme) => theme.id !== id));
    },
  };
}
