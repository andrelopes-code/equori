import { ArtCanvas } from "@/ui/card-face/art/art-canvas";

const darker = "oklch(from var(--card-face-color) calc(l - 0.09) c h)";
const lighter =
  "oklch(from var(--card-face-color) calc(l + 0.1) c calc(h + 14))";

export function Band() {
  return (
    <ArtCanvas>
      <polygon points="252,0 314,0 198,252 136,252" style={{ fill: darker }} />
      <polygon points="314,0 400,0 400,252 198,252" style={{ fill: lighter }} />
      <path
        vectorEffect="non-scaling-stroke"
        d="M252 0 136 252"
        stroke="currentColor"
        strokeOpacity=".18"
        strokeWidth="1"
      />
    </ArtCanvas>
  );
}
