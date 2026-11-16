import type { components } from "@/api/schema.gen";
import { useSetInstrumentHidden } from "@/features/instruments/api";
import { useT } from "@/i18n/i18n-provider";
import { HeaderAction } from "@/ui/navigation/header-action";

interface HideInstrumentActionProps {
  instrument: components["schemas"]["Instrument"];
}

// A238 HD7: the header action that keeps a security out of the book's lists, or returns it. It
// asks nothing: both directions are reversible.
export function HideInstrumentAction({
  instrument,
}: HideInstrumentActionProps) {
  const t = useT();
  const setHidden = useSetInstrumentHidden();

  if (instrument.type === "currency") return null;

  function handleClick() {
    setHidden.mutate({ code: instrument.code, hidden: !instrument.hidden });
  }

  return (
    <HeaderAction
      label={t(instrument.hidden ? "instrument.show" : "instrument.hide")}
      glyph={instrument.hidden ? "eye" : "eye-off"}
      wordsOnly
      loading={setHidden.isPending}
      onClick={handleClick}
    />
  );
}
