import { useEffect, useState } from "react";

import { logoTraits, type LogoTraits } from "@/ui/card-face/logo-traits";

const size = 32;
const cache = new Map<string, LogoTraits | undefined>();

export function useLogoTraits(url: string | undefined): LogoTraits | undefined {
  const [loaded, setLoaded] = useState<{
    url: string;
    traits: LogoTraits | undefined;
  }>();

  useEffect(() => {
    if (!url || cache.has(url)) {
      return;
    }

    let current = true;
    const image = new Image();

    image.decoding = "async";
    image.onload = () => {
      const traits = readTraits(image);

      cache.set(url, traits);

      if (current) {
        setLoaded({ url, traits });
      }
    };
    image.src = url;

    return () => {
      current = false;
    };
  }, [url]);

  if (!url) {
    return undefined;
  }

  if (cache.has(url)) {
    return cache.get(url);
  }

  return loaded?.url === url ? loaded.traits : undefined;
}

function readTraits(image: HTMLImageElement): LogoTraits | undefined {
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    return undefined;
  }

  context.drawImage(image, 0, 0, size, size);

  try {
    return logoTraits(context.getImageData(0, 0, size, size).data, size, size);
  } catch {
    // A cross-origin image taints the canvas and getImageData throws.
    return undefined;
  }
}
