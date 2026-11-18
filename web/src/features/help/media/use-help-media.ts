import { helpFigure, helpVideo } from "@/features/help/media/help-media";
import type {
  HelpFigureMedia,
  HelpVideoMedia,
} from "@/features/help/media/help-media";
import { useAppLocaleState } from "@/i18n/i18n-provider";

interface HelpMedia {
  figure: (id: string | undefined) => HelpFigureMedia | undefined;
  video: (id: string | undefined) => HelpVideoMedia | undefined;
}

// The figures and videos of the help in the reader's language.
export function useHelpMedia(): HelpMedia {
  const { locale } = useAppLocaleState();

  return {
    figure: (id) =>
      id === undefined ? undefined : helpFigure(id, locale.language),
    video: (id) =>
      id === undefined ? undefined : helpVideo(id, locale.language),
  };
}
