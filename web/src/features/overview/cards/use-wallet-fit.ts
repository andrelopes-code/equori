import { useCallback, useState } from "react";
import type { CSSProperties, RefCallback } from "react";

import { fitFace } from "@/features/overview/cards/fit-face";
import type { Fit } from "@/features/overview/cards/fit-face";
import { useMediaQuery, wideQuery } from "@/ui/runtime/use-media-query";

// The face width and the strip height that fill the widget, as the style of the wallet's grid, and the ref of the
// wallet. It measures the room the widget's body leaves, so the wallet follows a resize of the
// widget. Below the desk the grid draws a widget as tall as its content: there is no height to
// fill, and the stylesheet's own width stands.
export function useWalletFit(
  count: number,
): [CSSProperties | undefined, RefCallback<HTMLElement>] {
  const desk = useMediaQuery(wideQuery);
  const [fit, setFit] = useState<Fit>();

  const ref = useCallback(
    (wallet: HTMLElement | null) => {
      const body = wallet?.parentElement;

      if (wallet === null || body === null || body === undefined || !desk) {
        return undefined;
      }

      const read = () => {
        const box = getComputedStyle(body);
        const padding =
          parseFloat(box.paddingBlockStart) + parseFloat(box.paddingBlockEnd);

        setFit(
          fitFace({
            width: wallet.clientWidth,
            height: body.clientHeight - padding,
            count,
            rem: parseFloat(
              getComputedStyle(document.documentElement).fontSize,
            ),
          }),
        );
      };

      read();

      const observer = new ResizeObserver(read);
      observer.observe(body);

      return () => {
        observer.disconnect();
        setFit(undefined);
      };
    },
    [count, desk],
  );

  const style =
    fit === undefined
      ? undefined
      : ({
          "--face": `${String(fit.face)}px`,
          "--strip": `${String(fit.strip)}px`,
        } as CSSProperties);

  return [style, ref];
}
