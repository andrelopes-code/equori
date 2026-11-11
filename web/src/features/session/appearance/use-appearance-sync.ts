import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useApi } from "@/api/api-context";
import {
  appearanceQuery,
  meQuery,
  useSaveAppearance,
} from "@/features/session/api";
import { restoreAppearance, storedAppearance } from "@/theme/appearance";
import { useDensity } from "@/theme/density";
import { useMotion } from "@/theme/motion";
import { useScheme } from "@/theme/scheme";
import { useTextSize } from "@/theme/text-size";
import { useSavedThemes } from "@/theme/theme-file";
import { useThemeValues } from "@/theme/themes";

const SAVE_DELAY = 300;

export function useAppearanceSync(): void {
  const api = useApi();
  const { data: me } = useQuery({ ...meQuery(api), staleTime: Infinity });
  const memberID = me?.id;
  const { data: server } = useQuery({
    ...appearanceQuery(api, memberID ?? 0),
    enabled: memberID !== undefined,
  });
  const { mutate } = useSaveAppearance();

  // Subscribing re-renders on each change, so `local` is current.
  useThemeValues();
  useScheme();
  useDensity();
  useTextSize();
  useMotion();
  useSavedThemes();

  // The JSON last known to match the server; null until the first answer.
  const synced = useRef<string | null>(null);

  const local = JSON.stringify(storedAppearance());

  useEffect(() => {
    synced.current = null;
  }, [memberID]);

  useEffect(() => {
    if (synced.current !== null || server === undefined) return;

    if (Object.keys(server).length === 0) {
      synced.current = "{}";
      return;
    }

    restoreAppearance(server);
    synced.current = JSON.stringify(storedAppearance());
  }, [server, memberID]);

  useEffect(() => {
    if (synced.current === null || synced.current === local) return;

    const timer = setTimeout(() => {
      synced.current = local;
      mutate(JSON.parse(local) as Record<string, string>);
    }, SAVE_DELAY);

    return () => {
      clearTimeout(timer);
    };
  }, [local, server, mutate]);
}
